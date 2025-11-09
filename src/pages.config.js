import Home from './pages/Home';
import FlashStudy from './pages/FlashStudy';
import SpacedRepetition from './pages/SpacedRepetition';
import Progress from './pages/Progress';
import Settings from './pages/Settings';
import Focus from './pages/Focus';
import Welcome from './pages/Welcome';
import CardBrowser from './pages/CardBrowser';
import Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "FlashStudy": FlashStudy,
    "SpacedRepetition": SpacedRepetition,
    "Progress": Progress,
    "Settings": Settings,
    "Focus": Focus,
    "Welcome": Welcome,
    "CardBrowser": CardBrowser,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: Layout,
};