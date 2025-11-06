import classNames from "classnames";
import { useContext } from "react";
import { useRouter } from "next/router";
import { TabContext } from "utils/contexts/tab";

function slugify(tabName) {
  return tabName.toString().replace(/\s+/g, "-").toLowerCase();
}

export function slugifyAndEncode(tabName) {
  return tabName !== undefined ? encodeURIComponent(slugify(tabName)) : "";
}

export default function Tab({ tab }) {
  const { activeTab, setActiveTab } = useContext(TabContext);
  const router = useRouter();

  const matchesTab = decodeURIComponent(activeTab) === slugify(tab);

  const handleTabClick = () => {
    const encodedTab = slugifyAndEncode(tab);
    setActiveTab(encodedTab);
    
    // Use router to update hash instead of directly manipulating window.location
    // This prevents cross-origin security errors with Next.js router
    try {
      const newHash = `#${encodedTab}`;
      // Use router.replace with shallow routing to update just the hash
      router.replace(
        {
          pathname: router.pathname,
          query: router.query,
          hash: newHash,
        },
        undefined,
        { shallow: true, scroll: false }
      );
    } catch (error) {
      // Fallback to direct hash manipulation if router fails
      // But only if we're sure we're on the same origin
      console.warn("Failed to update hash via router, using fallback:", error);
      if (typeof window !== "undefined") {
        try {
          window.history.replaceState(null, "", `#${encodedTab}`);
        } catch (historyError) {
          // If replaceState fails, try the old method as last resort
          window.location.hash = `#${encodedTab}`;
        }
      }
    }
  };

  return (
    <li
      key={tab}
      role="presentation"
      className={classNames("text-theme-700 dark:text-theme-200 relative h-10 w-full rounded-md flex")}
    >
      <button
        id={`${tab}-tab`}
        type="button"
        role="tab"
        aria-controls={`#${tab}`}
        aria-selected={matchesTab ? "true" : "false"}
        className={classNames(
          "w-full rounded-md m-1",
          matchesTab ? "bg-theme-300/20 dark:bg-white/10" : "hover:bg-theme-100/20 dark:hover:bg-white/5",
        )}
        onClick={handleTabClick}
      >
        {tab}
      </button>
    </li>
  );
}
