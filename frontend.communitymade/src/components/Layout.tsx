import { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Box,
  Container,
  Divider,
  useMediaQuery,
  useTheme,
  Avatar,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Image as ImageIcon,
  People as PeopleIcon,
  Label as LabelIcon,
  Category as CategoryIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Dashboard as DashboardIcon,
  AdminPanelSettings as AdminIcon,
  Notifications as NotificationsIcon,
  ExitToApp as LogoutIcon,
  ArrowDropDown as ArrowDownIcon,
} from "@mui/icons-material";
import { Link as RouterLink, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

const browseLinks = [
  { text: "Posts", path: "/posts/", icon: <ImageIcon /> },
  { text: "Users", path: "/users/", icon: <PeopleIcon /> },
  { text: "Tags", path: "/tags/", icon: <LabelIcon /> },
  { text: "Categories", path: "/categories/", icon: <CategoryIcon /> },
];

const browseMenuLinks = browseLinks.slice(1);

const footerLinks = [
  { text: "About", path: "/about/" },
  { text: "FAQ", path: "/faq/" },
  { text: "GitHub", path: "/github/" },
  { text: "Privacy", path: "/privacy/" },
  { text: "Terms", path: "/terms/" },
];

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [accountAnchor, setAccountAnchor] = useState<null | HTMLElement>(null);
  const [browseAnchor, setBrowseAnchor] = useState<null | HTMLElement>(null);
  const { user } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    fetch("/v1/version")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setVersion(d?.data?.version ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    setAccountAnchor(null);
    setBrowseAnchor(null);
  }, [location.pathname]);

  const handleLogout = async () => {
    setAccountAnchor(null);
    try {
      await fetch("/v1/auth/sign-out", { method: "POST" });
    } catch {}
    window.location.href = "/";
  };

  const isBrowseActive = browseMenuLinks.some((link) => location.pathname === link.path);

  const accountMenu = (
    <Menu
      anchorEl={accountAnchor}
      open={Boolean(accountAnchor)}
      onClose={() => setAccountAnchor(null)}
    >
      <MenuItem
        component={RouterLink}
        to="/account/"
        onClick={() => setAccountAnchor(null)}
      >
        <ListItemIcon><PersonIcon /></ListItemIcon>
        Account
      </MenuItem>
      <MenuItem
        component={RouterLink}
        to="/dashboard/"
        onClick={() => setAccountAnchor(null)}
      >
        <ListItemIcon><DashboardIcon /></ListItemIcon>
        Dashboard
      </MenuItem>
      {user?.role === "admin" || user?.role === "moderator" ? (
        <MenuItem
          component={RouterLink}
          to="/admin/"
          onClick={() => setAccountAnchor(null)}
        >
          <ListItemIcon><AdminIcon /></ListItemIcon>
          Admin
        </MenuItem>
      ) : null}
      <Divider />
      <MenuItem onClick={handleLogout}>
        <ListItemIcon><LogoutIcon /></ListItemIcon>
        Log out
      </MenuItem>
    </Menu>
  );

  const browseMenu = (
    <Menu
      anchorEl={browseAnchor}
      open={Boolean(browseAnchor)}
      onClose={() => setBrowseAnchor(null)}
    >
      {browseMenuLinks.map((link) => (
        <MenuItem
          key={link.path}
          selected={location.pathname === link.path}
          component={RouterLink}
          to={link.path}
          onClick={() => setBrowseAnchor(null)}
        >
          <ListItemIcon>{link.icon}</ListItemIcon>
          {link.text}
        </MenuItem>
      ))}
    </Menu>
  );

  const drawer = (
    <Box sx={{ width: 260 }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <ImageIcon color="primary" />
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{ textDecoration: "none", color: "inherit" }}
        >
          imshare
        </Typography>
      </Box>
      <Divider />
      <List>
        <ListSubheader component="div">Browse</ListSubheader>
        {browseLinks.map((link) => (
          <ListItem key={link.path} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={link.path}
              selected={location.pathname === link.path}
            >
              <ListItemIcon>{link.icon}</ListItemIcon>
              <ListItemText primary={link.text} />
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem disablePadding>
          <ListItemButton
            component={RouterLink}
            to="/search/"
            selected={location.pathname === "/search/"}
          >
            <ListItemIcon><SearchIcon /></ListItemIcon>
            <ListItemText primary="Search" />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider />
      <List>
        <ListSubheader component="div">Account</ListSubheader>
        {user ? (
          <>
            <ListItem disablePadding>
              <ListItemButton
                component={RouterLink}
                to="/account/"
                selected={location.pathname === "/account/"}
              >
                <ListItemIcon><PersonIcon /></ListItemIcon>
                <ListItemText primary="Account" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/dashboard/">
                <ListItemIcon><DashboardIcon /></ListItemIcon>
                <ListItemText primary="Dashboard" />
              </ListItemButton>
            </ListItem>
            {user.role === "admin" || user.role === "moderator" ? (
              <ListItem disablePadding>
                <ListItemButton component={RouterLink} to="/admin/">
                  <ListItemIcon><AdminIcon /></ListItemIcon>
                  <ListItemText primary="Admin" />
                </ListItemButton>
              </ListItem>
            ) : null}
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/notifications/">
                <ListItemIcon><NotificationsIcon /></ListItemIcon>
                <ListItemText primary="Notifications" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Log out" />
              </ListItemButton>
            </ListItem>
          </>
        ) : (
          <>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/account/login/">
                <ListItemIcon><PersonIcon /></ListItemIcon>
                <ListItemText primary="Log in" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/account/register/">
                <ListItemIcon><PersonIcon /></ListItemIcon>
                <ListItemText primary="Register" />
              </ListItemButton>
            </ListItem>
          </>
        )}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="static">
        <Toolbar sx={{ px: { xs: 1, sm: 2 } }}>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              textDecoration: "none",
              color: "inherit",
              fontWeight: 700,
              letterSpacing: 0.5,
              mr: { md: 3 },
              whiteSpace: "nowrap",
            }}
          >
            imshare
          </Typography>

          {!isMobile && (
            <>
              <Button
                color="inherit"
                component={RouterLink}
                to="/posts/"
                startIcon={<ImageIcon />}
                sx={{
                  borderBottom: location.pathname === "/posts/" ? "2px solid" : 0,
                  borderColor: "common.white",
                  borderRadius: 0,
                  minWidth: 0,
                  px: 1.5,
                  fontWeight: location.pathname === "/posts/" ? 600 : 400,
                }}
              >
                Posts
              </Button>
              <Button
                color="inherit"
                aria-haspopup="true"
                onClick={(e) => setBrowseAnchor(e.currentTarget)}
                endIcon={<ArrowDownIcon />}
                sx={{
                  borderBottom: isBrowseActive ? "2px solid" : 0,
                  borderColor: "common.white",
                  borderRadius: 0,
                  minWidth: 0,
                  px: 1.5,
                  fontWeight: isBrowseActive ? 600 : 400,
                }}
              >
                Browse
              </Button>
            </>
          )}
          {browseMenu}

          <Box sx={{ flexGrow: 1 }} />

          {!isMobile && (
            <IconButton
              color="inherit"
              aria-label="Search"
              component={RouterLink}
              to="/search/"
              sx={{
                color: location.pathname === "/search/" ? "inherit" : "rgba(255,255,255,0.8)",
              }}
            >
              <SearchIcon />
            </IconButton>
          )}
          {user && (
            <IconButton
              color="inherit"
              aria-label="Notifications"
              component={RouterLink}
              to="/notifications/"
            >
              <NotificationsIcon />
            </IconButton>
          )}

          {user ? (
            <IconButton
              onClick={(e) => setAccountAnchor(e.currentTarget)}
              aria-label="Account menu"
              sx={{ ml: 0.5 }}
            >
              <Avatar
                src={user.avatarUrl}
                alt={user.name}
                sx={{ width: 32, height: 32 }}
              >
                {user.name?.charAt(0)?.toUpperCase()}
              </Avatar>
            </IconButton>
          ) : (
            <>
              <Button color="inherit" component={RouterLink} to="/account/login/">
                Log in
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/account/register/"
                sx={{
                  border: "1px solid rgba(255,255,255,0.6)",
                  borderRadius: 999,
                  ml: 1,
                }}
              >
                Sign up
              </Button>
            </>
          )}
          {accountMenu}
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen && isMobile}
        onClose={() => setDrawerOpen(false)}
      >
        {drawer}
      </Drawer>

      <Container maxWidth="lg" sx={{ mt: 3, mb: 4, flex: 1 }}>
        <Outlet />
      </Container>

      <Divider />
      <Box
        component="footer"
        sx={{
          py: 2,
          px: 3,
          textAlign: "center",
          color: "text.secondary",
          fontSize: "0.9rem",
        }}
      >
        {footerLinks.map((link, i) => (
          <span key={link.path}>
            {i > 0 && " · "}
            <RouterLink
              to={link.path}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {link.text}
            </RouterLink>
          </span>
        ))}
        {version && (
          <Typography variant="caption" sx={{ mt: 0.5, display: "block" }}>
            Version {version}
          </Typography>
        )}
      </Box>
    </Box>
  );
}