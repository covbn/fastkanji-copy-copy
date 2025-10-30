import Home from './pages/Home';
import FlashStudy from './pages/FlashStudy';
import SpacedRepetition from './pages/SpacedRepetition';
import Progress from './pages/Progress';
import Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "FlashStudy": FlashStudy,
    "SpacedRepetition": SpacedRepetition,
    "Progress": Progress,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: Layout,
};