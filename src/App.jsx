import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Header from "./components/Header/HeaderAuth";
import Sidebar from "./components/Sidebar/Sidebar";
import IconSidebar from "./components/Sidebar/IconSidebar";
import HomePage from "./components/HomePage/HomePage";
import Landing from "./components/Landing/Landing";
import AuthPage from "./components/AuthPage/AuthPage";
import RestaurantsPage from "./components/RestaurantsPage/RestaurantsPage";
import RestaurantDetailPage from "./components/RestaurantDetailPage/RestaurantDetailPage";
import CartPage from "./components/CartPage/CartPage";
import FaqPage from "./components/FaqPage/FaqPage";
import ContactPage from "./components/ContactPage/ContactPage";
import PartnerWithUsPage from "./components/PartnerWithUsPage/PartnerWithUsPage";
import AdvertiseWithUsPage from "./components/AdvertiseWithUsPage/AdvertiseWithUsPage";
import BlogPage from "./components/BlogPage/BlogPage";
import TermsAndConditionsPage from "./components/TermsAndConditionsPage/TermsAndConditionsPage";
import PrivacyPage from "./components/PrivacyPage/PrivacyPage";
import GiftCardPage from "./components/GiftCardPage/GiftCardPage";
import AccountPage from "./components/AccountPage/AccountPage";
import CheckoutPage from "./components/CheckoutPage/CheckoutPage";
import OrderConfirmationPage from "./components/OrderConfirmationPage/OrderConfirmationPage";
import LoadingSpinner from "./components/LoadingSpinner/LoadingSpinner";
import AdminLogin from "./components/AdminLogin/AdminLogin";
import AdminLayout from "./components/AdminLayout/AdminLayout";
import AdminDashboard from "./components/AdminDashboard/AdminDashboard";
import AdminOrders from "./components/AdminOrders/AdminOrders";
import AdminOrderEdit from "./components/AdminOrderEdit/AdminOrderEdit";
import AdminUsers from "./components/AdminUsers/AdminUsers";
import AdminRestaurants from "./components/AdminRestaurants/AdminRestaurants";
import AdminAnalytics from "./components/AdminAnalytics/AdminAnalytics";
import AdminAnalyticsOverview from "./components/AdminAnalytics/AdminAnalyticsOverview";
import AdminAnalyticsRevenue from "./components/AdminAnalytics/AdminAnalyticsRevenue";
import AdminAnalyticsOrders from "./components/AdminAnalytics/AdminAnalyticsOrders";
import AdminAnalyticsUsers from "./components/AdminAnalytics/AdminAnalyticsUsers";
import AdminAnalyticsRestaurants from "./components/AdminAnalytics/AdminAnalyticsRestaurants";
import AdminSettings from "./components/AdminSettings/AdminSettings";
import AdminRequests from "./components/AdminRequests/AdminRequests";
import AdminCampaigns from "./components/AdminCampaigns/AdminCampaigns";
import AdminNursingHomes from "./components/AdminNursingHomes/AdminNursingHomes";
import AdminNotFoundPage from "./components/AdminNotFoundPage/AdminNotFoundPage";
import NotFoundPage from "./components/NotFoundPage/NotFoundPage";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import OrdersClosedBanner from "./components/OrdersClosedBanner/OrdersClosedBanner";
import { MenuProvider } from "./context/MenuContext";
import { AuthProvider } from "./context/AuthContextProvider";
import { CartProvider } from "./context/CartProvider";
import { useAuth } from "./hooks/useAuth";
import { useScrollToTop } from "./hooks/useScrollToTop";
import logger from "./utils/logger";
import "./App.scss";

import HelpPage from "./components/HelpPage/HelpPage";
import NursingHomeLogin from "./components/NursingHomeLogin/NursingHomeLogin";
import NursingHomeAdminLogin from "./components/NursingHomeAdminLogin/NursingHomeAdminLogin";
import NursingHomeAdminGate from "./components/NursingHomeAdminGate/NursingHomeAdminGate";
import NursingHomeLayout from "./components/NursingHomeLayout/NursingHomeLayout";
import NursingHomeDashboard from "./components/NursingHomeDashboard/NursingHomeDashboard";
import NursingHomeOrderCreation from "./components/NursingHomeOrderCreation/OrderCreation";
import NursingHomeOrderPayment from "./components/NursingHomeOrderPayment/OrderPayment";
import NursingHomeOrders from "./components/NursingHomeOrders/NursingHomeOrders";
import NursingHomeOrderDetails from "./components/NursingHomeOrderDetails/OrderDetails";
import NursingHomeOrderConfirmation from "./components/NursingHomeOrderConfirmation/OrderConfirmation";

function NhRedirectToDashboard() {
  const location = useLocation();
  return <Navigate to={`/nursing-homes/dashboard${location.search}`} replace />;
}

const PUBLIC_ROUTES = ["/landing", "/signin", "/signup", "/blog", "/faq", "/contact", "/partner", "/advertise", "/help", "/terms", "/privacy", "/admin", "/nursing-homes/login", "/nursing-homes/admin", "/nursing-homes/admin/login"];
const APP_ROUTES = ["/home", "/restaurants", "/restaurant", "/cart", "/checkout", "/order-confirmation", "/gift-card", "/account"];

function AuthenticatedApp() {
  const { user, loading, tempAddress } = useAuth();
  const location = useLocation();
  const [initialLoad, setInitialLoad] = useState(true);
  const pathname = location.pathname;

  useScrollToTop();

  useEffect(() => {
    if (!loading && initialLoad) {
      setInitialLoad(false);
    }
  }, [loading, initialLoad]);

  useEffect(() => {
    logger.debug('App.jsx - State changed:', {
      user: !!user,
      userId: user?.id,
      loading,
      tempAddress: !!tempAddress,
      pathname,
      userObject: user ? { id: user.id, email: user.email } : null
    });
  }, [user, loading, tempAddress, pathname]);

  if (loading && initialLoad) {
    return (
      <div className="app-loading">
        <LoadingSpinner 
          size="large" 
          text="Loading application..." 
          variant="primary"
        />
      </div>
    );
  }

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + "/"));
  const isAppRoute = APP_ROUTES.some(route => pathname === route || pathname.startsWith(route + "/"));

  if (pathname === "/") {
    if (user) {
      logger.debug('App.jsx - Authenticated user, redirecting to /home');
      return <Navigate to="/home" replace />;
    } else if (tempAddress) {
      logger.debug('App.jsx - Guest with address, redirecting to /home');
      return <Navigate to="/home" replace />;
    } else {
      logger.debug('App.jsx - No auth/address, redirecting to /landing');
      return <Navigate to="/landing" replace />;
    }
  }

  if (user) {
    if (pathname === "/landing" || pathname === "/signin" || pathname === "/signup") {
      logger.debug('App.jsx - Authenticated user on landing/auth, redirecting to /home');
      return <Navigate to="/home" replace />;
    }
    return renderApp();
  }

  if (tempAddress) {
    return renderApp();
  }

  if (isPublicRoute) {
    return renderApp();
  } else if (isAppRoute) {
    logger.debug('App.jsx - No auth/address accessing app route, redirecting to /landing');
    return <Navigate to="/landing" replace />;
  } else {
    logger.debug('App.jsx - No auth/address accessing unknown route, showing 404 page');
    return renderApp();
  }

  function renderApp() {
    const isAuthRoute = ["/signin", "/signup"].includes(pathname);
    const isLandingRoute = pathname === "/landing";
    const isAdminRoute = pathname.startsWith("/admin");
    const isNursingHomeRoute = pathname.startsWith("/nursing-homes");
    
    if (isNursingHomeRoute) {
      return (
        <Routes>
          <Route path="/nursing-homes/login" element={<NursingHomeLogin />} />
          <Route path="/nursing-homes/admin/login" element={<NursingHomeAdminLogin />} />
          <Route path="/nursing-homes/admin" element={<NursingHomeAdminGate />} />
          <Route path="/nursing-homes" element={<NursingHomeLayout />}>
            <Route path="dashboard" element={<NursingHomeDashboard />} />
            <Route path="orders" element={<NursingHomeOrders />} />
            <Route path="orders/:orderId" element={<NursingHomeOrderDetails />} />
            <Route path="orders/:orderId/confirmation" element={<NursingHomeOrderConfirmation />} />
            <Route path="order/new/:residentId" element={<NursingHomeOrderCreation />} />
            <Route path="order/:orderId/payment" element={<NursingHomeOrderPayment />} />
            <Route index element={<NhRedirectToDashboard />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/nursing-homes/*" element={<NotFoundPage />} />
        </Routes>
      );
    }
    
    if (isAdminRoute) {
      return (
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/*" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:orderId" element={<AdminOrderEdit />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="restaurants" element={<AdminRestaurants />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="analytics/overview" element={<AdminAnalyticsOverview />} />
            <Route path="analytics/revenue" element={<AdminAnalyticsRevenue />} />
            <Route path="analytics/orders" element={<AdminAnalyticsOrders />} />
            <Route path="analytics/users" element={<AdminAnalyticsUsers />} />
            <Route path="analytics/restaurants" element={<AdminAnalyticsRestaurants />} />
            <Route path="requests" element={<AdminRequests />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="nursing-homes" element={<AdminNursingHomes />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="*" element={<AdminNotFoundPage />} />
          </Route>
        </Routes>
      );
    }
    
    return (
      <div className="app-container">
        {!isAuthRoute && !isLandingRoute && <Header />}
        {!isAuthRoute && !isLandingRoute && <OrdersClosedBanner />}
        {!isAuthRoute && !isLandingRoute && <Sidebar />}
        {!isAuthRoute && !isLandingRoute && <IconSidebar />}
        <main className="main-content">
          <Routes>
            <Route path="/landing" element={<Landing />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/restaurants" element={<RestaurantsPage />} />
            <Route path="/restaurant/:id" element={<RestaurantDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/partner" element={<PartnerWithUsPage />} />
            <Route path="/advertise" element={<AdvertiseWithUsPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/terms" element={<TermsAndConditionsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/gift-card" element={<GiftCardPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/signin" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    );
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <MenuProvider>
            <Router>
              <ErrorBoundary>
                <AuthenticatedApp />
              </ErrorBoundary>
            </Router>
          </MenuProvider>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;