import { createStore } from './store'

// The mark shrugs. Asked for something it does not have (a search of the
// portfolio that finds no company, a command the terminal does not know), the
// desk answers the way its name would: the mark in the menu bar lifts its arms,
// once. Whatever came up empty says so here and the menu bar listens for it
// (MenuBar.tsx). The phone has no menu bar: there the count is kept and nothing
// is drawn.

/** How many times the desk has had nothing to give. The mark shrugs once for each. */
export const shrugs = createStore(0)

/** The desk has nothing to give for what was asked. */
export const shrug = () => shrugs.set((times) => times + 1)
