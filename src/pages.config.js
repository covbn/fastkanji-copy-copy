import CardBrowser from './pages/CardBrowser';
import Feedback from './pages/Feedback';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Progress from './pages/Progress';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import Welcome from './pages/Welcome';
import FlashStudy from './pages/FlashStudy';
import Focus from './pages/Focus';
import SpacedRepetition from './pages/SpacedRepetition';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CardBrowser": CardBrowser,
    "Feedback": Feedback,
    "Home": Home,
    "Profile": Profile,
    "Progress": Progress,
    "Settings": Settings,
    "Subscription": Subscription,
    "Welcome": Welcome,
    "FlashStudy": FlashStudy,
    "Focus": Focus,
    "SpacedRepetition": SpacedRepetition,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};