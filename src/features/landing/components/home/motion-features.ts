/**
 * framer-motion's DOM animation features, loaded after first paint (RIN-1370). The
 * landing sections only animate on scroll into view, so `LazyMotion` can fetch this
 * bundle asynchronously and keep it out of the 220 KiB marketing-static first load.
 * @see https://motion.dev/docs/react-reduce-bundle-size#lazy-loading
 */
export const loadMotionFeatures = () =>
  import('./motion-dom-animation').then((features) => features.default);
