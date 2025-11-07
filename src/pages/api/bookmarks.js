import { bookmarksResponse } from "utils/config/api-response";
import { saveBookmarks, findBookmark, findBookmarkGroup } from "utils/config/bookmark-helpers";
import createLogger from "utils/logger";

const logger = createLogger("bookmarks-api");

export default async function handler(req, res) {
  try {
    // Log the request for debugging
    console.log(`[BOOKMARKS API] ${req.method} request received`);
    logger.debug(`${req.method} request to /api/bookmarks`);
    
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(200).end();
    }
    
    if (req.method === "GET") {
      const bookmarks = await bookmarksResponse();
      return res.status(200).json(bookmarks);
    }

    if (req.method === "POST") {
      // Add a new bookmark
      logger.debug("POST body:", JSON.stringify(req.body));
      const { groupName, bookmarkName, href, abbr, icon, description } = req.body || {};

      if (!groupName || !bookmarkName || !href) {
        return res.status(400).json({ error: "groupName, bookmarkName, and href are required" });
      }

      const bookmarks = await bookmarksResponse();
      let group = findBookmarkGroup(bookmarks, groupName);

      if (!group) {
        // Create new group if it doesn't exist
        group = { name: groupName, bookmarks: [] };
        bookmarks.push(group);
      }

      // Check if bookmark already exists
      if (findBookmark(bookmarks, groupName, bookmarkName)) {
        return res.status(409).json({ error: "Bookmark already exists" });
      }

      // Add the new bookmark
      const newBookmark = {
        name: bookmarkName,
        href,
        ...(abbr && { abbr }),
        ...(icon && { icon }),
        ...(description && { description }),
      };

      group.bookmarks.push(newBookmark);
      await saveBookmarks(bookmarks);

      return res.status(201).json({ success: true, bookmark: newBookmark });
    }

    if (req.method === "PUT") {
      // Update an existing bookmark
      console.log("[BOOKMARKS API] PUT request received, body:", req.body);
      logger.debug("PUT body:", JSON.stringify(req.body));
      const { groupName, bookmarkName, newGroupName, newBookmarkName, href, abbr, icon, description } = req.body || {};

      if (!groupName || !bookmarkName) {
        return res.status(400).json({ error: "groupName and bookmarkName are required" });
      }

      const bookmarks = await bookmarksResponse();
      const group = findBookmarkGroup(bookmarks, groupName);

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const bookmarkIndex = group.bookmarks.findIndex((b) => b.name === bookmarkName);
      if (bookmarkIndex === -1) {
        return res.status(404).json({ error: "Bookmark not found" });
      }

      // If moving to a different group
      if (newGroupName && newGroupName !== groupName) {
        let targetGroup = findBookmarkGroup(bookmarks, newGroupName);
        if (!targetGroup) {
          targetGroup = { name: newGroupName, bookmarks: [] };
          bookmarks.push(targetGroup);
        }

        // Check if bookmark with new name already exists in target group
        if (newBookmarkName && findBookmark(bookmarks, newGroupName, newBookmarkName)) {
          return res.status(409).json({ error: "Bookmark with that name already exists in target group" });
        }

        // Remove from old group
        const bookmark = group.bookmarks.splice(bookmarkIndex, 1)[0];

        // Update bookmark properties
        if (newBookmarkName) bookmark.name = newBookmarkName;
        if (href) bookmark.href = href;
        if (abbr !== undefined) bookmark.abbr = abbr || undefined;
        if (icon !== undefined) bookmark.icon = icon || undefined;
        if (description !== undefined) bookmark.description = description || undefined;

        // Add to new group
        targetGroup.bookmarks.push(bookmark);
      } else {
        // Update in place
        const bookmark = group.bookmarks[bookmarkIndex];

        // Check if new name conflicts with existing bookmark
        if (newBookmarkName && newBookmarkName !== bookmarkName) {
          if (findBookmark(bookmarks, groupName, newBookmarkName)) {
            return res.status(409).json({ error: "Bookmark with that name already exists" });
          }
        }

        if (newBookmarkName) bookmark.name = newBookmarkName;
        if (href) bookmark.href = href;
        if (abbr !== undefined) bookmark.abbr = abbr || undefined;
        if (icon !== undefined) bookmark.icon = icon || undefined;
        if (description !== undefined) bookmark.description = description || undefined;
      }

      await saveBookmarks(bookmarks);
      return res.json({ success: true });
    }

    if (req.method === "DELETE") {
      // Delete a bookmark
      logger.debug("DELETE body:", JSON.stringify(req.body));
      const { groupName, bookmarkName } = req.body || {};

      if (!groupName || !bookmarkName) {
        return res.status(400).json({ error: "groupName and bookmarkName are required" });
      }

      const bookmarks = await bookmarksResponse();
      const group = findBookmarkGroup(bookmarks, groupName);

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const bookmarkIndex = group.bookmarks.findIndex((b) => b.name === bookmarkName);
      if (bookmarkIndex === -1) {
        return res.status(404).json({ error: "Bookmark not found" });
      }

      group.bookmarks.splice(bookmarkIndex, 1);

      // Remove group if it's now empty
      if (group.bookmarks.length === 0) {
        const groupIndex = bookmarks.findIndex((g) => g.name === groupName);
        if (groupIndex !== -1) {
          bookmarks.splice(groupIndex, 1);
        }
      }

      await saveBookmarks(bookmarks);
      return res.json({ success: true });
    }

    if (req.method === "PATCH") {
      // Reorder bookmarks within a group
      logger.debug("PATCH body:", JSON.stringify(req.body));
      const { groupName, fromIndex, toIndex } = req.body || {};

      if (groupName === undefined || fromIndex === undefined || toIndex === undefined) {
        return res.status(400).json({ error: "groupName, fromIndex, and toIndex are required" });
      }

      if (fromIndex === toIndex) {
        return res.status(200).json({ success: true });
      }

      const bookmarks = await bookmarksResponse();
      const group = findBookmarkGroup(bookmarks, groupName);

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      if (fromIndex < 0 || fromIndex >= group.bookmarks.length || toIndex < 0 || toIndex >= group.bookmarks.length) {
        return res.status(400).json({ error: "Invalid index range" });
      }

      // Move the bookmark from fromIndex to toIndex
      const [movedBookmark] = group.bookmarks.splice(fromIndex, 1);
      group.bookmarks.splice(toIndex, 0, movedBookmark);

      await saveBookmarks(bookmarks);
      return res.json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("[BOOKMARKS API] Error:", error);
    logger.error("Error in bookmarks API:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

