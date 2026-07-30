/**
 * The only place a card's surface treatment is defined. A class string rather
 * than a component: cards here are forms, list items, links and sections, and
 * wrapping each in a div just to get a border would nest for nothing.
 */
export function cardClass(interactive = false) {
  return `border-edge bg-surface rounded-panel shadow-card border${
    interactive ? ' hover:border-accent-400 hover:shadow-raised transition-all' : ''
  }`;
}
