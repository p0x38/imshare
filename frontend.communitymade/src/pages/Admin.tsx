import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  Grid,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Skeleton,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  Select,
  MenuItem,
} from "@mui/material";
import {
  People as PeopleIcon,
  Image as ImageIcon,
  Flag as FlagIcon,
  Block as BlockIcon,
  Gavel as GavelIcon,
  AdminPanelSettings as AdminIcon,
  ContentCopy as CopyIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

interface Overview {
  users: number;
  posts: number;
  openReports: number;
  bannedUsers: number;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  isBanned: boolean;
  warningCount?: number;
}

interface Report {
  id: string;
  reason: string;
  postId?: string;
  commentId?: string;
}

interface LogEntry {
  id: string;
  action: string;
  actor?: { name: string };
  targetUser?: { name: string };
  reason?: string;
}

interface RegToken {
  token: string;
  expiresAt: string;
}

async function adminApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (r.status === 401) throw new Error("unauthorized");
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.error?.message ?? `HTTP ${r.status}`);
  }
  return r.json();
}

export default function Admin() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [regToken, setRegToken] = useState<RegToken | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [modOpen, setModOpen] = useState(false);
const [modAction, setModAction] = useState<"ban" | "warn">("ban");
const [modSearch, setModSearch] = useState("");
const [modResults, setModResults] = useState<UserInfo[]>([]);
const [modTarget, setModTarget] = useState<UserInfo | null>(null);
const [modReason, setModReason] = useState("");
const [modDurationValue, setModDurationValue] = useState("");
const [modDurationUnit, setModDurationUnit] = useState("permanent");
const [modSaving, setModSaving] = useState(false);

  const load = async () => {
    try {
      const [o, t, u, r, l]: any[] = await Promise.all([
        adminApi("/v1/admin/overview"),
        adminApi("/v1/admin/registration-token"),
        adminApi("/v1/admin/users?limit=50"),
        adminApi("/v1/admin/reports"),
        adminApi("/v1/admin/logs"),
      ]);
      setOverview(o.data);
      setRegToken(t.data);
      setUsers(u.data);
      setReports(r.data);
      setLogs(l.data);
    } catch (e: any) {
      if (e.message === "unauthorized") navigate("/account/login/");
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const kickUser = async (id: string) => {
    try {
      await adminApi(`/v1/admin/users/${id}/kick`, { method: "POST", body: "{}" });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const unbanUser = async (id: string) => {
    try {
      await adminApi(`/v1/admin/users/${id}/unban`, { method: "POST", body: "{}" });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openModDialog = (target: UserInfo | null) => {
    setModAction("ban");
    setModSearch("");
    setModResults([]);
    setModTarget(target);
    setModReason("");
    setModDurationValue("");
    setModDurationUnit("permanent");
    setModOpen(true);
  };

  const searchUsers = async (value: string) => {
    setModSearch(value);
    if (value.trim().length < 2) {
      setModResults([]);
      return;
    }
    try {
      const r: any = await adminApi(
        `/v1/admin/users?limit=10&search=${encodeURIComponent(value.trim())}`
      );
      setModResults(r.data ?? []);
    } catch {
      setModResults([]);
    }
  };

  const submitMod = async () => {
    if (!modTarget) return;
    setModSaving(true);
    try {
      if (modAction === "warn") {
        await adminApi(`/v1/admin/users/${modTarget.id}/warn`, {
          method: "POST",
          body: JSON.stringify({ reason: modReason }),
        });
      } else {
        await adminApi(`/v1/admin/users/${modTarget.id}/ban`, {
          method: "POST",
          body: JSON.stringify({
            reason: modReason,
            durationValue: modDurationValue,
            durationUnit: modDurationUnit,
          }),
        });
      }
      setModOpen(false);
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setModSaving(false);
    }
  };

  const resolveReport = async (id: string, status: string) => {
    try {
      await adminApi(`/v1/admin/reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Skeleton variant="text" height={40} width="60%" />
      </Card>
    );
  }

  return (
    <>
      <Typography variant="h4" gutterBottom>
        <AdminIcon sx={{ verticalAlign: "middle", mr: 1 }} />
        Admin
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {overview && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Box sx={{ textAlign: "center" }}>
                  <PeopleIcon color="primary" />
                  <Typography variant="h4">{overview.users}</Typography>
                  <Typography color="text.secondary">Users</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Box sx={{ textAlign: "center" }}>
                  <ImageIcon color="primary" />
                  <Typography variant="h4">{overview.posts}</Typography>
                  <Typography color="text.secondary">Posts</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Box sx={{ textAlign: "center" }}>
                  <FlagIcon color="warning" />
                  <Typography variant="h4">{overview.openReports}</Typography>
                  <Typography color="text.secondary">Open reports</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Box sx={{ textAlign: "center" }}>
                  <BlockIcon color="error" />
                  <Typography variant="h4">{overview.bannedUsers}</Typography>
                  <Typography color="text.secondary">Banned</Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {regToken && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Registration token
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography
                sx={{
                  fontFamily: "monospace",
                  bgcolor: "action.hover",
                  p: 1,
                  borderRadius: 1,
                  flex: 1,
                  overflow: "auto",
                }}
              >
                {regToken.token}
              </Typography>
              <Button
                size="small"
                startIcon={<CopyIcon />}
                onClick={() => navigator.clipboard.writeText(regToken.token)}
              >
                Copy
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Expires: {new Date(regToken.expiresAt).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Users
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<GavelIcon />}
              onClick={() => openModDialog(null)}
            >
              Moderate user...
            </Button>
          </Box>
          <TableContainer component={Paper} sx={{ bgcolor: "background.paper" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Warnings</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell>{u.warningCount ?? 0}</TableCell>
                    <TableCell>{u.isBanned ? "Banned" : "Active"}</TableCell>
                    <TableCell>
                      {u.isBanned ? (
                        <Button size="small" onClick={() => unbanUser(u.id)}>
                          Unban
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="small"
                            color="warning"
                            onClick={() => openModDialog(u)}
                          >
                            Warn
                          </Button>
                          <Button size="small" onClick={() => kickUser(u.id)}>
                            Kick
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => openModDialog(u)}
                          >
                            Ban
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Open reports
          </Typography>
          {reports.length === 0 ? (
            <Typography color="text.secondary">No open reports.</Typography>
          ) : (
            <TableContainer component={Paper} sx={{ bgcolor: "background.paper" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Reason</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.reason}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={() => resolveReport(r.id, "resolved")}
                        >
                          Resolve
                        </Button>
                        <Button
                          size="small"
                          color="warning"
                          onClick={() => resolveReport(r.id, "dismissed")}
                        >
                          Dismiss
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Moderation log
          </Typography>
          {logs.length === 0 ? (
            <Typography color="text.secondary">No moderation actions yet.</Typography>
          ) : (
            <TableContainer component={Paper} sx={{ bgcolor: "background.paper" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Action</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.action}</TableCell>
                      <TableCell>{l.actor?.name}</TableCell>
                      <TableCell>{l.targetUser?.name}</TableCell>
                      <TableCell>{l.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={modOpen}
        onClose={() => setModOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Moderate user{modAction === "ban" ? " (ban)" : " (warn)"}
        </DialogTitle>
        <DialogContent>
          <FormControl sx={{ mt: 1, mb: 1 }}>
            <RadioGroup row value={modAction} onChange={(e) => setModAction(e.target.value as "ban" | "warn")}>
              <FormControlLabel value="warn" control={<Radio />} label="Warn" />
              <FormControlLabel value="ban" control={<Radio />} label="Ban" />
            </RadioGroup>
          </FormControl>

          {modTarget ? (
            <Box
              sx={{
                mb: 2,
                p: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="body2">
                Target: <strong>{modTarget.name}</strong> ({modTarget.email})
              </Typography>
              <Button size="small" sx={{ mt: 0.5 }} onClick={() => setModTarget(null)}>
                Change target
              </Button>
            </Box>
          ) : (
            <>
              <TextField
                autoFocus
                fullWidth
                label="Type username or email"
                value={modSearch}
                onChange={(e) => searchUsers(e.target.value)}
                sx={{ mb: 1 }}
              />
              {modResults.length > 0 && (
                <Box sx={{ maxHeight: 180, overflow: "auto", mb: 1 }}>
                  {modResults.map((r) => (
                    <Box
                      key={r.id}
                      sx={{
                        p: 1,
                        mb: 0.5,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        cursor: "pointer",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                      onClick={() => setModTarget(r)}
                    >
                      <Typography variant="body2">
                        {r.name} ({r.email})
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}

          <TextField
            fullWidth
            label={modAction === "warn" ? "Warning reason" : "Ban reason"}
            value={modReason}
            onChange={(e) => setModReason(e.target.value)}
            sx={{ mb: 2 }}
          />

          {modAction === "ban" && (
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                label="Duration"
                type="number"
                value={modDurationValue}
                onChange={(e) => setModDurationValue(e.target.value)}
                sx={{ flex: 1 }}
                disabled={modDurationUnit === "permanent"}
              />
              <Select
                value={modDurationUnit}
                onChange={(e) => setModDurationUnit(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="permanent">Permanent</MenuItem>
                <MenuItem value="seconds">Seconds</MenuItem>
                <MenuItem value="minutes">Minutes</MenuItem>
                <MenuItem value="hours">Hours</MenuItem>
                <MenuItem value="days">Days</MenuItem>
              </Select>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModOpen(false)}>Cancel</Button>
          <Button
            onClick={submitMod}
            color={modAction === "ban" ? "error" : "warning"}
            disabled={modSaving || !modTarget || !modReason.trim()}
          >
            {modSaving ? "Saving..." : modAction === "ban" ? "Ban" : "Warn"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
