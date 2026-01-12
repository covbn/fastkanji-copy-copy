import CardBrowser from './pages/CardBrowser';
import Feedback from './pages/Feedback';
import FlashStudy from './pages/FlashStudy';
import Focus from './pages/Focus';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Progress from './pages/Progress';
import Settings from './pages/Settings';
import SpacedRepetition from './pages/SpacedRepetition';
import Subscription from './pages/Subscription';
import Welcome from './pages/Welcome';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CardBrowser": CardBrowser,
    "Feedback": Feedback,
    "FlashStudy": FlashStudy,
    "Focus": Focus,
    "Home": Home,
    "Profile": Profile,
    "Progress": Progress,
    "Settings": Settings,
    "SpacedRepetition": SpacedRepetition,
    "Subscription": Subscription,
    "Welcome": Welcome,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};