/**
 * Storage resets for the verify scripts.
 *
 * The app keeps the user's work — designs *and* images — in IndexedDB, and that outranks the
 * designs in localStorage. So a script that seeds a design into localStorage and reloads must
 * clear the database in the same breath, or the project autosaved by the *previous* page load
 * hydrates over the design under test and the script quietly checks the wrong thing.
 *
 * The delete has to happen immediately before the reload it is preparing, not once at the top:
 * the live page autosaves ~half a second after any state change, so anything that changes state
 * (selecting a device, say) puts a project back.
 */
const DB_NAME = 'screenshot-studio'

/** Drop the stored projects, so the next load starts with no work in progress. */
export const clearProjects = (page) =>
  page.evaluate(
    (name) =>
      new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(name)
        // `blocked` fires if a connection is still open; the app closes its own on versionchange,
        // so this resolves rather than hanging the script.
        request.onsuccess = request.onerror = request.onblocked = () => resolve()
      }),
    DB_NAME,
  )

/** Everything: the projects, and the designs, theme, language, and device in localStorage. */
export const resetStorage = async (page) => {
  await page.evaluate(() => localStorage.clear())
  await clearProjects(page)
}
