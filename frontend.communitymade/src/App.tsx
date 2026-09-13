import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import darkTheme from "./theme";
import { AuthProvider } from "./auth";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Posts from "./pages/Posts";
import PostView from "./pages/PostView";
import NewPost from "./pages/NewPost";
import Users from "./pages/Users";
import UserView from "./pages/UserView";
import Tags from "./pages/Tags";
import TagView from "./pages/TagView";
import Categories from "./pages/Categories";
import CategoryView from "./pages/CategoryView";
import SearchPage from "./pages/Search";
import Account from "./pages/Account";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import Dashboard from "./pages/Dashboard";
import DashboardPosts from "./pages/DashboardPosts";
import DashboardPostView from "./pages/DashboardPostView";
import DashboardPostEdit from "./pages/DashboardPostEdit";
import Admin from "./pages/Admin";
import About from "./pages/About";
import Faq from "./pages/Faq";
import Github from "./pages/Github";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/posts/" element={<Posts />} />
              <Route path="/posts/:postId" element={<PostView />} />
              <Route path="/users/" element={<Users />} />
              <Route path="/users/:userId" element={<UserView />} />
              <Route path="/tags/" element={<Tags />} />
              <Route path="/tags/:tagId" element={<TagView />} />
              <Route path="/categories/" element={<Categories />} />
              <Route path="/categories/:categoryId" element={<CategoryView />} />
              <Route path="/search/" element={<SearchPage />} />
              <Route path="/account/" element={<Account />} />
              <Route path="/account/login/" element={<Login />} />
              <Route path="/account/register/" element={<Register />} />
              <Route path="/account/profile/" element={<Profile />} />
              <Route path="/notifications/" element={<Notifications />} />
              <Route path="/dashboard/" element={<Dashboard />} />
              <Route path="/dashboard/posts/" element={<DashboardPosts />} />
              <Route path="/dashboard/posts/new/" element={<NewPost />} />
              <Route path="/dashboard/posts/:postId/" element={<DashboardPostView />} />
              <Route path="/dashboard/posts/:postId/edit/" element={<DashboardPostEdit />} />
              <Route path="/admin/" element={<Admin />} />
              <Route path="/about/" element={<About />} />
              <Route path="/faq/" element={<Faq />} />
              <Route path="/github/" element={<Github />} />
              <Route path="/privacy/" element={<Privacy />} />
              <Route path="/terms/" element={<Terms />} />
              <Route
                path="/dashboard/tags/"
                element={<NotFound status={501} title="Coming soon" message="Tag management is coming soon." />}
              />
              <Route
                path="/dashboard/categories/"
                element={<NotFound status={501} title="Coming soon" message="Category management is coming soon." />}
              />
              <Route
                path="/dashboard/settings/"
                element={<Profile />}
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
