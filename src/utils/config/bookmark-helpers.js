import { promises as fs } from "fs";
import path from "path";

import yaml from "js-yaml";

import { bookmarksResponse } from "./api-response";

import checkAndCopyConfig, { CONF_DIR } from "utils/config/config";

/**
 * Converts the bookmarks array structure back to YAML format
 * @param {Array} bookmarksArray - Array of bookmark groups in the format returned by bookmarksResponse()
 * @returns {Array} YAML-compatible array structure
 */
export function bookmarksArrayToYaml(bookmarksArray) {
  if (!bookmarksArray || bookmarksArray.length === 0) {
    return [];
  }

  return bookmarksArray
    .filter((group) => group && group.name && group.bookmarks && group.bookmarks.length > 0)
    .map((group) => {
      const groupObj = {};
      groupObj[group.name] = group.bookmarks
        .filter((bookmark) => bookmark && bookmark.name && bookmark.href)
        .map((bookmark) => {
          const bookmarkObj = {};
          const bookmarkData = {};

          // Add properties in a specific order for readability
          if (bookmark.abbr) bookmarkData.abbr = bookmark.abbr;
          if (bookmark.icon) bookmarkData.icon = bookmark.icon;
          bookmarkData.href = bookmark.href;
          if (bookmark.description) bookmarkData.description = bookmark.description;

          bookmarkObj[bookmark.name] = [bookmarkData];
          return bookmarkObj;
        });
      return groupObj;
    });
}

/**
 * Saves bookmarks to the YAML file
 * @param {Array} bookmarksArray - Array of bookmark groups
 * @returns {Promise<void>}
 */
export async function saveBookmarks(bookmarksArray) {
  checkAndCopyConfig("bookmarks.yaml");
  
  const bookmarksYaml = path.join(CONF_DIR, "bookmarks.yaml");
  const yamlData = bookmarksArrayToYaml(bookmarksArray);
  const yamlString = yaml.dump(yamlData, {
    indent: 2,
    lineWidth: -1, // Don't wrap lines
    noRefs: true,
    quotingType: '"',
  });
  
  await fs.writeFile(bookmarksYaml, yamlString, "utf8");
}

/**
 * Finds a bookmark by group name and bookmark name
 * @param {Array} bookmarksArray - Array of bookmark groups
 * @param {string} groupName - Name of the group
 * @param {string} bookmarkName - Name of the bookmark
 * @returns {Object|null} The bookmark object or null if not found
 */
export function findBookmark(bookmarksArray, groupName, bookmarkName) {
  const group = bookmarksArray.find((g) => g.name === groupName);
  if (!group) return null;
  
  const bookmark = group.bookmarks.find((b) => b.name === bookmarkName);
  return bookmark || null;
}

/**
 * Finds a bookmark group by name
 * @param {Array} bookmarksArray - Array of bookmark groups
 * @param {string} groupName - Name of the group
 * @returns {Object|null} The group object or null if not found
 */
export function findBookmarkGroup(bookmarksArray, groupName) {
  return bookmarksArray.find((g) => g.name === groupName) || null;
}

