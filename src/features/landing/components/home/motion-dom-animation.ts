import { domAnimation } from 'framer-motion';

/** Only domAnimation, so the async chunk tree-shakes the rest of framer-motion (RIN-1370). */
const motionDomAnimation = domAnimation;

export default motionDomAnimation;
