import { Dialog, Transition, Combobox } from "@headlessui/react";
import classNames from "classnames";
import { Fragment, useState, useEffect, useMemo } from "react";
import { MdClose, MdAdd, MdEdit, MdDelete, MdSave, MdSearch, MdCheck, MdKeyboardArrowDown, MdDragHandle } from "react-icons/md";
import useSWR, { mutate } from "swr";

// Fetcher function for SWR
const fetcher = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const error = new Error("An error occurred while fetching bookmarks");
      error.info = await res.json().catch(() => ({ error: res.statusText }));
      error.status = res.status;
      throw error;
    }
    return res.json();
  } catch (fetchError) {
    // Handle network errors (CORS, connection refused, etc.)
    const error = new Error(fetchError.message || "Failed to fetch bookmarks");
    error.info = { error: fetchError.message || "Network error" };
    error.status = 0;
    error.isNetworkError = true;
    throw error;
  }
};

export default function BookmarksManager({ isOpen, onClose }) {
  const { data: bookmarks, error, isLoading, mutate: mutateBookmarks } = useSWR(
    isOpen ? "/api/bookmarks" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 1000,
    }
  );
  const [editingBookmark, setEditingBookmark] = useState(null);
  const [formData, setFormData] = useState({
    groupName: "",
    bookmarkName: "",
    href: "",
    abbr: "",
    icon: "",
    description: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupNameQuery, setGroupNameQuery] = useState("");
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [draggedBookmark, setDraggedBookmark] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setEditingBookmark(null);
      setFormData({
        groupName: "",
        bookmarkName: "",
        href: "",
        abbr: "",
        icon: "",
        description: "",
      });
      setErrorMessage("");
      setSearchQuery("");
      setGroupNameQuery("");
      setDraggedBookmark(null);
      setDraggedOverIndex(null);
    }
  }, [isOpen]);

  // Sync groupNameQuery with formData.groupName when formData changes externally (e.g., when editing)
  useEffect(() => {
    setGroupNameQuery(formData.groupName);
  }, [formData.groupName]);

  // Get list of existing group names
  const existingGroups = useMemo(() => {
    if (!bookmarks) return [];
    return bookmarks.map((group) => group.name).filter(Boolean);
  }, [bookmarks]);

  // Filter groups for the combobox
  const filteredGroups = useMemo(() => {
    // Show all groups when dropdown is first opened or when query is empty
    if (showAllGroups || !groupNameQuery || !groupNameQuery.trim()) {
      return existingGroups;
    }
    const query = groupNameQuery.toLowerCase().trim();
    return existingGroups.filter((groupName) =>
      groupName.toLowerCase().includes(query)
    );
  }, [existingGroups, groupNameQuery, showAllGroups]);

  // Filter bookmarks based on search query
  const filteredBookmarks = useMemo(() => {
    if (!bookmarks || !searchQuery.trim()) {
      return bookmarks || [];
    }

    const query = searchQuery.toLowerCase().trim();
    return bookmarks
      .map((group) => {
        const filteredBookmarks = group.bookmarks?.filter((bookmark) => {
          const nameMatch = bookmark.name?.toLowerCase().includes(query);
          const hrefMatch = bookmark.href?.toLowerCase().includes(query);
          const descriptionMatch = bookmark.description?.toLowerCase().includes(query);
          const groupMatch = group.name?.toLowerCase().includes(query);
          return nameMatch || hrefMatch || descriptionMatch || groupMatch;
        });

        if (!filteredBookmarks || filteredBookmarks.length === 0) {
          // If group name matches but no bookmarks match, still show the group
          if (group.name?.toLowerCase().includes(query)) {
            return { ...group, bookmarks: [] };
          }
          return null;
        }

        return {
          ...group,
          bookmarks: filteredBookmarks,
        };
      })
      .filter((group) => group !== null);
  }, [bookmarks, searchQuery]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorMessage("");
  };

  const handleAdd = () => {
    setEditingBookmark(null);
    setFormData({
      groupName: "",
      bookmarkName: "",
      href: "",
      abbr: "",
      icon: "",
      description: "",
    });
    setErrorMessage("");
    setGroupNameQuery("");
  };

  const handleEdit = (groupName, bookmark) => {
    setEditingBookmark({ groupName, bookmarkName: bookmark.name });
    setFormData({
      groupName,
      bookmarkName: bookmark.name,
      href: bookmark.href || "",
      abbr: bookmark.abbr || "",
      icon: bookmark.icon || "",
      description: bookmark.description || "",
    });
    setErrorMessage("");
  };

  const handleSave = async () => {
    setErrorMessage("");
    setLoading(true);

    try {
      const { groupName, bookmarkName, href, abbr, icon, description } = formData;

      if (!groupName.trim() || !bookmarkName.trim() || !href.trim()) {
        setErrorMessage("Group name, bookmark name, and URL are required");
        setLoading(false);
        return;
      }

      // Validate URL
      try {
        new URL(href);
      } catch {
        setErrorMessage("Please enter a valid URL");
        setLoading(false);
        return;
      }

      if (editingBookmark) {
        // Update existing bookmark
        // Always include optional fields when editing - send empty string to clear them
        // This ensures JSON.stringify includes them in the request body (undefined values are omitted)
        const requestBody = {
          groupName: editingBookmark.groupName,
          bookmarkName: editingBookmark.bookmarkName,
          newGroupName: groupName !== editingBookmark.groupName ? groupName : undefined,
          newBookmarkName: bookmarkName !== editingBookmark.bookmarkName ? bookmarkName : undefined,
          href,
          abbr: abbr.trim() || "", // Send empty string to clear, not undefined
          icon: icon.trim() || "", // Send empty string to clear, not undefined
          description: description.trim() || "", // Send empty string to clear, not undefined
        };

        console.log("Sending PUT request:", requestBody);

        let response;
        try {
          console.log("Attempting PUT request to /api/bookmarks");
          console.log("Request body:", requestBody);
          
          // Use absolute URL to ensure it works
          const apiUrl = window.location.origin + "/api/bookmarks";
          console.log("Full API URL:", apiUrl);
          
          response = await fetch(apiUrl, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            credentials: "same-origin",
          });
          console.log("Response received - status:", response.status, response.statusText);
          console.log("Response headers:", Object.fromEntries(response.headers.entries()));
        } catch (fetchError) {
          console.error("Fetch error details:", {
            error: fetchError,
            message: fetchError.message,
            stack: fetchError.stack,
            name: fetchError.name,
            cause: fetchError.cause,
          });
          // Check if it's a network error
          if (fetchError.message === "Failed to fetch" || fetchError.name === "TypeError") {
            throw new Error("Cannot connect to server. Please ensure the dev server is running and try again.");
          }
          throw new Error(`Network error: ${fetchError.message || "Failed to connect to server. Please check if the server is running."}`);
        }

        if (!response.ok) {
          let errorMessage = "Failed to update bookmark";
          try {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
          } catch (parseError) {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }
      } else {
        // Add new bookmark
        const postBody = {
          groupName,
          bookmarkName,
          href,
          abbr: abbr.trim() || undefined,
          icon: icon.trim() || undefined,
          description: description.trim() || undefined,
        };
        
        console.log("Attempting POST request to /api/bookmarks");
        console.log("Request body:", postBody);
        
        let response;
        try {
          const apiUrl = window.location.origin + "/api/bookmarks";
          response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(postBody),
            credentials: "same-origin",
          });
          console.log("POST Response received - status:", response.status, response.statusText);
        } catch (fetchError) {
          console.error("Fetch error:", fetchError);
          throw new Error(`Network error: ${fetchError.message || "Failed to connect to server"}`);
        }

        if (!response.ok) {
          let errorMessage = "Failed to add bookmark";
          try {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
          } catch (parseError) {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }
      }

      // Refresh bookmarks data - force revalidation
      await mutateBookmarks();
      // Also trigger global cache invalidation for homepage
      await mutate("/api/bookmarks");
      handleAdd();
    } catch (err) {
      console.error("Error in handleSave:", err);
      const errorMessage = err?.message || err?.toString() || "An unexpected error occurred";
      setErrorMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (groupName, bookmarkName) => {
    if (!confirm(`Are you sure you want to delete "${bookmarkName}"?`)) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      let response;
      try {
        const apiUrl = window.location.origin + "/api/bookmarks";
        response = await fetch(apiUrl, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupName, bookmarkName }),
          credentials: "same-origin",
        });
      } catch (fetchError) {
        console.error("Fetch error:", fetchError);
        throw new Error(`Network error: ${fetchError.message || "Failed to connect to server"}`);
      }

      if (!response.ok) {
        let errorMessage = "Failed to delete bookmark";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Refresh bookmarks data - force revalidation
      await mutateBookmarks();
      // Also trigger global cache invalidation for homepage
      await mutate("/api/bookmarks");
      if (editingBookmark && editingBookmark.groupName === groupName && editingBookmark.bookmarkName === bookmarkName) {
        handleAdd();
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (groupName, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const apiUrl = window.location.origin + "/api/bookmarks";
      const response = await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName, fromIndex, toIndex }),
        credentials: "same-origin",
      });

      if (!response.ok) {
        let errorMessage = "Failed to reorder bookmark";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Refresh bookmarks data - force revalidation
      await mutateBookmarks();
      // Also trigger global cache invalidation for homepage
      await mutate("/api/bookmarks");
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg bg-theme-50 dark:bg-theme-800 shadow-xl">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-theme-200 dark:border-theme-700">
                  <Dialog.Title className="text-xl font-semibold text-theme-800 dark:text-theme-200">
                    Manage Bookmarks
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-md text-theme-600 dark:text-theme-400 hover:bg-theme-200 dark:hover:bg-theme-700"
                  >
                    <MdClose className="w-6 h-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {error && (
                    <div className="mb-4 p-4 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                      <p className="font-medium">Failed to load bookmarks</p>
                      <p className="text-sm mt-1">
                        {error.isNetworkError || error.message === "Failed to fetch" || error.message?.includes("Failed to fetch")
                          ? "Unable to connect to the server. Please ensure the server is running and try again."
                          : error.info?.error || error.message || "An error occurred while loading bookmarks. Please try again."}
                      </p>
                      <button
                        onClick={() => mutateBookmarks()}
                        className="mt-2 px-3 py-1 text-sm bg-red-200 dark:bg-red-800/50 hover:bg-red-300 dark:hover:bg-red-800/70 rounded"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {isLoading && !bookmarks && (
                    <div className="mb-4 p-4 text-center text-theme-600 dark:text-theme-400">
                      Loading bookmarks...
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Form Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-theme-800 dark:text-theme-200">
                          {editingBookmark ? "Edit Bookmark" : "Add New Bookmark"}
                        </h3>
                        {editingBookmark && (
                          <button
                            onClick={handleAdd}
                            className="text-sm text-theme-600 dark:text-theme-400 hover:text-theme-800 dark:hover:text-theme-200"
                          >
                            New Bookmark
                          </button>
                        )}
                      </div>

                      {errorMessage && (
                        <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm">
                          {errorMessage}
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
                            Group Name *
                          </label>
                          <Combobox
                            value={formData.groupName}
                            onChange={(value) => {
                              setFormData((prev) => ({ ...prev, groupName: value }));
                              setGroupNameQuery(value || "");
                              setShowAllGroups(false);
                              setErrorMessage("");
                            }}
                          >
                            {({ open }) => {
                              // Show all groups when dropdown opens (only set if not already set to avoid re-renders)
                              if (open && !showAllGroups) {
                                // Use setTimeout to avoid setting state during render
                                setTimeout(() => setShowAllGroups(true), 0);
                              } else if (!open && showAllGroups) {
                                setTimeout(() => setShowAllGroups(false), 0);
                              }

                              return (
                                <div className="relative">
                                  <Combobox.Input
                                    className="w-full px-3 py-2 rounded-md border border-theme-300 dark:border-theme-600 bg-theme-100 dark:bg-theme-900 text-theme-900 dark:text-theme-100 focus:outline-none focus:ring-2 focus:ring-theme-500"
                                    displayValue={(value) => value || ""}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setGroupNameQuery(value);
                                      setFormData((prev) => ({ ...prev, groupName: value }));
                                      setShowAllGroups(false); // Start filtering when user types
                                      setErrorMessage("");
                                    }}
                                    placeholder="e.g., Personal, Work"
                                  />
                                  <Combobox.Button
                                    onClick={() => {
                                      setShowAllGroups(true);
                                    }}
                                    className="absolute inset-y-0 right-0 flex items-center pr-2"
                                  >
                                    <MdKeyboardArrowDown
                                      className="h-5 w-5 text-theme-400"
                                      aria-hidden="true"
                                    />
                                  </Combobox.Button>
                                  <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-theme-50 dark:bg-theme-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    {filteredGroups.length === 0 && groupNameQuery && groupNameQuery.trim() !== "" ? (
                                      <div className="relative cursor-default select-none px-4 py-2 text-theme-700 dark:text-theme-300">
                                        Create new group: "{groupNameQuery}"
                                      </div>
                                    ) : (
                                      filteredGroups.map((groupName) => (
                                        <Combobox.Option
                                          key={groupName}
                                          value={groupName}
                                          className={({ active }) =>
                                            classNames(
                                              "relative cursor-default select-none py-2 pl-10 pr-4",
                                              active
                                                ? "bg-theme-600 text-white"
                                                : "text-theme-900 dark:text-theme-200"
                                            )
                                          }
                                        >
                                          {({ selected, active }) => (
                                            <>
                                              <span
                                                className={classNames(
                                                  "block truncate",
                                                  selected ? "font-medium" : "font-normal"
                                                )}
                                              >
                                                {groupName}
                                              </span>
                                              {selected ? (
                                                <span
                                                  className={classNames(
                                                    "absolute inset-y-0 left-0 flex items-center pl-3",
                                                    active ? "text-white" : "text-theme-600"
                                                  )}
                                                >
                                                  <MdCheck className="h-5 w-5" aria-hidden="true" />
                                                </span>
                                              ) : null}
                                            </>
                                          )}
                                        </Combobox.Option>
                                      ))
                                    )}
                                  </Combobox.Options>
                                </div>
                              );
                            }}
                          </Combobox>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
                            Bookmark Name *
                          </label>
                          <input
                            type="text"
                            name="bookmarkName"
                            value={formData.bookmarkName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 rounded-md border border-theme-300 dark:border-theme-600 bg-theme-100 dark:bg-theme-900 text-theme-900 dark:text-theme-100 focus:outline-none focus:ring-2 focus:ring-theme-500"
                            placeholder="e.g., YouTube, GitHub"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
                            URL *
                          </label>
                          <input
                            type="url"
                            name="href"
                            value={formData.href}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 rounded-md border border-theme-300 dark:border-theme-600 bg-theme-100 dark:bg-theme-900 text-theme-900 dark:text-theme-100 focus:outline-none focus:ring-2 focus:ring-theme-500"
                            placeholder="https://example.com"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
                            Abbreviation (2 letters)
                          </label>
                          <input
                            type="text"
                            name="abbr"
                            value={formData.abbr}
                            onChange={handleInputChange}
                            maxLength={2}
                            className="w-full px-3 py-2 rounded-md border border-theme-300 dark:border-theme-600 bg-theme-100 dark:bg-theme-900 text-theme-900 dark:text-theme-100 focus:outline-none focus:ring-2 focus:ring-theme-500"
                            placeholder="GH"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
                            Icon URL
                          </label>
                          <input
                            type="url"
                            name="icon"
                            value={formData.icon}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 rounded-md border border-theme-300 dark:border-theme-600 bg-theme-100 dark:bg-theme-900 text-theme-900 dark:text-theme-100 focus:outline-none focus:ring-2 focus:ring-theme-500"
                            placeholder="https://example.com/icon.png"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 rounded-md border border-theme-300 dark:border-theme-600 bg-theme-100 dark:bg-theme-900 text-theme-900 dark:text-theme-100 focus:outline-none focus:ring-2 focus:ring-theme-500"
                            placeholder="Optional description"
                          />
                        </div>

                        <button
                          onClick={handleSave}
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-theme-600 hover:bg-theme-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <MdSave className="w-5 h-5" />
                          {loading ? "Saving..." : editingBookmark ? "Update Bookmark" : "Add Bookmark"}
                        </button>
                      </div>
                    </div>

                    {/* Bookmarks List Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-theme-800 dark:text-theme-200">Existing Bookmarks</h3>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MdSearch className="h-5 w-5 text-theme-400" />
                        </div>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search bookmarks..."
                          className="w-full pl-10 pr-3 py-2 rounded-md border border-theme-300 dark:border-theme-600 bg-theme-100 dark:bg-theme-900 text-theme-900 dark:text-theme-100 focus:outline-none focus:ring-2 focus:ring-theme-500"
                        />
                      </div>
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {isLoading && !bookmarks ? (
                          <div className="text-center text-theme-500 dark:text-theme-400 p-4">
                            Loading bookmarks...
                          </div>
                        ) : error && !bookmarks ? (
                          <div className="text-center text-red-500 dark:text-red-400 p-4">
                            Failed to load bookmarks. Please try again.
                          </div>
                        ) : filteredBookmarks && filteredBookmarks.length > 0 ? (
                          filteredBookmarks.map((group) => (
                            <div key={group.name} className="border border-theme-200 dark:border-theme-700 rounded-md">
                              <div className="p-2 bg-theme-100 dark:bg-theme-900 border-b border-theme-200 dark:border-theme-700 rounded-t-md">
                                <h4 className="font-medium text-theme-800 dark:text-theme-200">{group.name}</h4>
                              </div>
                              <div className="p-2 space-y-1">
                                {group.bookmarks && group.bookmarks.length > 0 ? (
                                  group.bookmarks.map((bookmark, bookmarkIndex) => {
                                    const isDragging = draggedBookmark?.groupName === group.name && draggedBookmark?.bookmarkIndex === bookmarkIndex;
                                    const isDraggedOver = draggedOverIndex !== null && draggedOverIndex.groupName === group.name && draggedOverIndex.bookmarkIndex === bookmarkIndex;
                                    const canDrag = !searchQuery.trim(); // Disable dragging when search is active
                                    
                                    return (
                                      <div
                                        key={`${group.name}-${bookmark.name}-${bookmark.href}`}
                                        draggable={canDrag}
                                        onDragStart={(e) => {
                                          if (!canDrag) {
                                            e.preventDefault();
                                            return;
                                          }
                                          // Find the actual index in the original bookmarks array
                                          const originalGroup = bookmarks?.find((g) => g.name === group.name);
                                          if (!originalGroup) {
                                            e.preventDefault();
                                            return;
                                          }
                                          const actualIndex = originalGroup.bookmarks.findIndex((b) => 
                                            b.name === bookmark.name && b.href === bookmark.href
                                          );
                                          if (actualIndex === -1) {
                                            e.preventDefault();
                                            return;
                                          }
                                          setDraggedBookmark({ groupName: group.name, bookmarkIndex: actualIndex });
                                          e.dataTransfer.effectAllowed = "move";
                                          e.dataTransfer.setData("text/html", "");
                                        }}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.dataTransfer.dropEffect = "move";
                                          if (draggedBookmark && draggedBookmark.groupName === group.name) {
                                            if (!draggedOverIndex || draggedOverIndex.groupName !== group.name || draggedOverIndex.bookmarkIndex !== bookmarkIndex) {
                                              setDraggedOverIndex({ groupName: group.name, bookmarkIndex });
                                            }
                                          }
                                        }}
                                        onDragLeave={(e) => {
                                          // Only clear if we're leaving the element entirely
                                          if (!e.currentTarget.contains(e.relatedTarget)) {
                                            setDraggedOverIndex(null);
                                          }
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          if (draggedBookmark && draggedBookmark.groupName === group.name && canDrag) {
                                            // Find the actual indices in the original bookmarks array
                                            const originalGroup = bookmarks?.find((g) => g.name === group.name);
                                            if (!originalGroup) return;
                                            
                                            const draggedBookmarkObj = originalGroup.bookmarks[draggedBookmark.bookmarkIndex];
                                            const targetBookmarkObj = bookmark;
                                            
                                            const fromIndex = originalGroup.bookmarks.findIndex((b) => 
                                              b.name === draggedBookmarkObj.name && b.href === draggedBookmarkObj.href
                                            );
                                            const toIndex = originalGroup.bookmarks.findIndex((b) => 
                                              b.name === targetBookmarkObj.name && b.href === targetBookmarkObj.href
                                            );
                                            
                                            if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                                              handleReorder(group.name, fromIndex, toIndex);
                                            }
                                          }
                                          setDraggedBookmark(null);
                                          setDraggedOverIndex(null);
                                        }}
                                        onDragEnd={() => {
                                          setDraggedBookmark(null);
                                          setDraggedOverIndex(null);
                                        }}
                                        className={classNames(
                                          "flex items-center justify-between p-2 rounded hover:bg-theme-100 dark:hover:bg-theme-900 transition-colors relative",
                                          canDrag ? "cursor-move" : "cursor-default",
                                          isDragging && "opacity-50",
                                          isDraggedOver && "border-t-2 border-white"
                                        )}
                                      >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <div
                                            className={classNames(
                                              "cursor-grab active:cursor-grabbing",
                                              canDrag 
                                                ? "text-theme-400 dark:text-theme-500 hover:text-theme-600 dark:hover:text-theme-300" 
                                                : "text-theme-300 dark:text-theme-600 cursor-not-allowed"
                                            )}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            title={canDrag ? "Drag to reorder" : "Search must be cleared to reorder"}
                                          >
                                            <MdDragHandle className="w-5 h-5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium text-theme-800 dark:text-theme-200 truncate">
                                              {bookmark.name}
                                            </div>
                                            <div className="text-sm text-theme-600 dark:text-theme-400 truncate">
                                              {bookmark.href}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                          <button
                                            onClick={() => handleEdit(group.name, bookmark)}
                                            className="p-1.5 rounded text-theme-600 dark:text-theme-400 hover:bg-theme-200 dark:hover:bg-theme-700"
                                            title="Edit"
                                            onMouseDown={(e) => e.stopPropagation()}
                                          >
                                            <MdEdit className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleDelete(group.name, bookmark.name)}
                                            className="p-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                                            title="Delete"
                                            onMouseDown={(e) => e.stopPropagation()}
                                          >
                                            <MdDelete className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-sm text-theme-500 dark:text-theme-400 p-2">
                                    No bookmarks in this group
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : searchQuery.trim() ? (
                          <div className="text-center text-theme-500 dark:text-theme-400 p-4">
                            No bookmarks found matching "{searchQuery}"
                          </div>
                        ) : (
                          <div className="text-center text-theme-500 dark:text-theme-400 p-4">
                            No bookmarks yet. Add your first bookmark!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

