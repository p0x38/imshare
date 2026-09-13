import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
} from "@mui/material";
import {
  MarkEmailRead as MarkReadIcon,
  Notifications as NotificationsIcon,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api";

interface Notification {
  id: string;
  message: string;
  postId?: string;
  readAt?: string;
  createdAt: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);

  const load = async () => {
    try {
      const r: any = await api("/v1/me/notifications?limit=100");
      setNotifications(r.data);
      setTotal(r.pagination?.total || 0);
    } catch (err: any) {
      setError(err.status === 401 ? "Please sign in." : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    try {
      await api(`/v1/me/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
      });
      load();
    } catch {}
  };

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Typography color="text.secondary">Loading...</Typography>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Card>
    );
  }

  return (
    <>
      <Typography variant="h4" gutterBottom>
        <NotificationsIcon sx={{ verticalAlign: "middle", mr: 1 }} />
        Notifications
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {total} notification(s)
      </Typography>
      <Card>
        <CardContent>
          {notifications.length === 0 ? (
            <Typography color="text.secondary">No notifications yet.</Typography>
          ) : (
            <List>
              {notifications.map((n) => (
                <ListItem
                  key={n.id}
                  sx={{
                    bgcolor: n.readAt ? "transparent" : "action.hover",
                    borderRadius: 1,
                    mb: 1,
                  }}
                  secondaryAction={
                    <Button
                      size="small"
                      startIcon={<MarkReadIcon />}
                      onClick={() => markRead(n.id)}
                    >
                      Mark read
                    </Button>
                  }
                >
                  <ListItemText
                    primary={n.message}
                    secondary={
                      <>
                        {new Date(n.createdAt).toLocaleString()}
                        {!n.readAt && (
                          <Chip label="unread" size="small" color="primary" sx={{ ml: 1 }} />
                        )}
                        {n.postId && (
                          <RouterLink
                            to={`/posts/${encodeURIComponent(n.postId)}`}
                            style={{ marginLeft: 8 }}
                          >
                            Open post
                          </RouterLink>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </>
  );
}
