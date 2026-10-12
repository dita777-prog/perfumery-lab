import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import {
  FlaskConical, Package, Users, TestTube, Lightbulb,
  BarChart3, Settings, Search, Menu, X, Boxes, Archive, Droplet, Heart,
  Layers, ReceiptText, Tag, LogOut
} from "lucide-react";
import MaterialsPage from "./pages/materials";
import WishlistPage from "./pages/wishlist";
import FormulasPage from "./pages/formulas";
import SuppliersPage from "./pages/suppliers";
import TestsPage from "./pages/tests";
import DecisionsPage from "./pages/decisions";
import StockPage from "./pages/stock";
import FormulaInventoryPage from "./pages/formula-inventory";
import SettingsPage from "./pages/settings";
import SearchPage from "./pages/search";
import ArchivePage from "./pages/archive";
import ComponentsPage from "./pages/components";
import InvoicesPage from "./pages/invoices";
import ProductsPage from "./pages/products";
import LoginPage from "./pages/login";
import NotFound from "./pages/not-found";

function AppLayout() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = [
    { href: "/", icon: Package, label: "Materials" },
    { href: "/formulas", icon: FlaskConical, label: "Formulas" },
    { href: "/wishlist", icon: Heart, label: "Wishlist" },
    { href: "/suppliers", icon: Users, label: "Suppliers" },
    { href: "/tests", icon: TestTube, label: "Tests" },
    { href: "/decisions", icon: Lightbulb, label: "Decisions" },
    { href: "/stock", icon: Boxes, label: "Stock" },
    { href: "/formula-inventory", icon: Droplet, label: "Formula Inventory" },
    { href: "/components", icon: Layers, label: "Components" },
    { href: "/invoices", icon: ReceiptText, label: "Invoices" },
    { href: "/products", icon: Tag, label: "Products" },
    { href: "/search", icon: Search, label: "Search" },
    { href: "/archive", icon: Archive, label: "Archive" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-card"
        onClick={() => setMobileOpen(!mobileOpen)}
        data-testid="mobile-menu-toggle"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar */}
      <aside className={`
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 fixed md:static inset-y-0 left-0 z-40
        w-56 bg-[hsl(0,0%,8%)] border-r border-border
        flex flex-col transition-transform duration-200
      `}>
        <div className="px-4 py-3 border-b border-border">
          <img src="./logo-full.png" alt="Drip of Infinity" className="w-36 opacity-90" />
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {nav.map(item => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const isHome = item.href === "/" && location === "/";
            const active = isActive || isHome;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-md text-sm cursor-pointer transition-colors
                    ${active ? 'bg-[hsl(183,70%,36%)]/15 text-[hsl(183,70%,50%)]' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}
                  `}
                  onClick={() => setMobileOpen(false)}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <button
          className="flex items-center gap-3 px-4 py-3 border-t border-border text-sm text-muted-foreground hover:text-foreground"
          onClick={() => supabase.auth.signOut()}
          data-testid="button-sign-out"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          <Switch>
            <Route path="/" component={MaterialsPage} />
            <Route path="/wishlist" component={WishlistPage} />
            <Route path="/formulas" component={FormulasPage} />
            <Route path="/formulas/:id" component={FormulasPage} />
            <Route path="/suppliers" component={SuppliersPage} />
            <Route path="/tests" component={TestsPage} />
            <Route path="/decisions" component={DecisionsPage} />
            <Route path="/stock" component={StockPage} />
            <Route path="/formula-inventory" component={FormulaInventoryPage} />
            <Route path="/components" component={ComponentsPage} />
            <Route path="/invoices" component={InvoicesPage} />
            <Route path="/products" component={ProductsPage} />
            <Route path="/search" component={SearchPage} />
            <Route path="/archive" component={ArchivePage} />
            <Route path="/settings" component={SettingsPage} />
            <Route component={NotFound} />
          </Switch>
        </ErrorBoundary>
      </main>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
    </div>
  );
}

function App() {
  // undefined = still checking the stored session, null = signed out
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) queryClient.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {session ? (
        <Router hook={useHashLocation}>
          <AppLayout />
          <Toaster />
        </Router>
      ) : (
        <LoginPage />
      )}
    </QueryClientProvider>
  );
}

export default App;
