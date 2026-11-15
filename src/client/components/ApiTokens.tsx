import { Delete, Edit } from "@mui/icons-material";
import {
    Alert,
    Button,
    Card,
    CardContent,
    Checkbox,
    FormControlLabel,
    FormGroup,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    MenuItem,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Action = "read" | "write" | "delete";
type Permissions = Record<string, Action[]>;
type Expiry = "never" | "7" | "30" | "90" | "custom";

type Token = {
    id: string;
    name: string;
    tokenPrefix: string;
    permissions: Permissions;
    enabled: boolean;
    expiresAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

const actions: Action[] = ["read", "write", "delete"];

const resources = [
    "posts",
    "uploads",
    "users",
    "comments",
    "tags",
    "categories",
    "notifications",
    "me",
    "account",
    "admin",
    "emojis",
    "reactions",
    "follows",
    "search",
    "recommendations",
    "permalinks",
    "texts",
];

const defaultPermissions = (): Permissions =>
    Object.fromEntries(
        resources
            .filter((resource) => resource !== "*" && resource !== "admin")
            .map((resource) => [resource, ["read"]]),
    );

function resolveExpiry(mode: Expiry, custom: string): string | null | undefined {
    if (mode === "never") return null;
    if (mode === "custom") {
        const date = new Date(custom);
        return custom && !Number.isNaN(date.getTime()) && date > new Date()
            ? date.toISOString()
            : undefined;
    }
    return new Date(Date.now() + Number(mode) * 86_400_000).toISOString();
}

function localDateTime(value: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ""
        : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString() : "Never";
}

function PermissionEditor({
    value,
    onChange,
}: {
    value: Permissions;
    onChange: (value: Permissions) => void;
}) {
    function toggle(resource: string, action: Action, checked: boolean) {
        const next = { ...value };
        const selected = new Set(next[resource] ?? []);

        if (checked) selected.add(action);
        else selected.delete(action);

        if (selected.size) next[resource] = [...selected];
        else delete next[resource];

        onChange(next);
    }

    return (
        <TableContainer component={Paper} variant="outlined">
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Resource</TableCell>
                        {actions.map((action) => (
                            <TableCell key={action} align="center">
                                {action}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {resources.map((resource) => (
                        <TableRow key={resource}>
                            <TableCell>
                                {resource === "*" ? "All resources (*)" : resource}
                            </TableCell>
                            {actions.map((action) => (
                                <TableCell key={action} align="center">
                                    <Checkbox
                                        size="small"
                                        checked={value[resource]?.includes(action) ?? false}
                                        onChange={(event) =>
                                            toggle(resource, action, event.target.checked)
                                        }
                                    />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

function ExpirySelector({
    value,
    custom,
    onChange,
    onCustomChange,
}: {
    value: Expiry;
    custom: string;
    onChange: (value: Expiry) => void;
    onCustomChange: (value: string) => void;
}) {
    return (
        <Stack spacing={2}>
            <TextField
                select
                label="Expiration"
                value={value}
                onChange={(event) => onChange(event.target.value as Expiry)}
            >
                <MenuItem value="never">Never</MenuItem>
                <MenuItem value="7">7 days</MenuItem>
                <MenuItem value="30">30 days</MenuItem>
                <MenuItem value="90">90 days</MenuItem>
                <MenuItem value="custom">Custom date</MenuItem>
            </TextField>
            {value === "custom" && (
                <TextField
                    type="datetime-local"
                    label="Expiration date"
                    value={custom}
                    onChange={(event) => onCustomChange(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                />
            )}
        </Stack>
    );
}

export function ApiTokens() {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [name, setName] = useState("");
    const [secret, setSecret] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [permissions, setPermissions] = useState<Permissions>(defaultPermissions);
    const [expiry, setExpiry] = useState<Expiry>("never");
    const [customExpiry, setCustomExpiry] = useState("");
    const [editing, setEditing] = useState<Token | null>(null);
    const [editName, setEditName] = useState("");
    const [editPermissions, setEditPermissions] = useState<Permissions>({});
    const [editExpiry, setEditExpiry] = useState<Expiry>("never");
    const [editCustomExpiry, setEditCustomExpiry] = useState("");
    const [busyToken, setBusyToken] = useState<string | null>(null);

    async function load() {
        try {
            setTokens((await api<{ data: Token[] }>("/v1/me/api-tokens")).data);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to load API tokens.");
        }
    }
    useEffect(() => {
        void load();
    }, []);

    async function create() {
        if (!name.trim()) return;

        const expiresAt = resolveExpiry(expiry, customExpiry);
        if (expiresAt === undefined) {
            setError("Choose a valid future expiration date.");
            return;
        }

        setBusy(true);
        setError("");
        setSecret("");

        try {
            const result = await api<{ data: Token & { token: string } }>("/v1/me/api-tokens", {
                method: "POST",
                body: JSON.stringify({ name: name.trim(), permissions, expiresAt }),
            });
            setSecret(result.data.token);
            setName("");
            setExpiry("never");
            setCustomExpiry("");

            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to create API token.");
        } finally {
            setBusy(false);
        }
    }

    function openEditor(token: Token) {
        setEditing(token);
        setEditName(token.name);
        setEditPermissions(token.permissions ?? {});
        setEditExpiry(token.expiresAt ? "custom" : "never");
        setEditCustomExpiry(localDateTime(token.expiresAt));
    }

    async function saveEdit() {
        if (!editing) return;

        const expiresAt = resolveExpiry(editExpiry, editCustomExpiry);
        if (expiresAt === undefined || !editName.trim()) {
            setError("Enter a valid name and future expiration date.");
            return;
        }

        setBusy(true);
        setError("");

        try {
            await api(`/v1/me/api-tokens/${encodeURIComponent(editing.id)}`, {
                method: "PATCH",
                body: JSON.stringify({
                    name: editName.trim(),
                    permissions: editPermissions,
                    expiresAt,
                }),
            });

            setEditing(null);
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to update API token.");
        } finally {
            setBusy(false);
        }
    }

    async function toggleEnabled(token: Token) {
        setBusyToken(token.id);
        setError("");

        try {
            await api(`/v1/me/api-tokens/${encodeURIComponent(token.id)}`, {
                method: "PATCH",
                body: JSON.stringify({ enabled: !token.enabled }),
            });

            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to update API token.");
        } finally {
            setBusyToken(null);
        }
    }

    async function revoke(id: string) {
        if (!confirm("Revoke this API token? It cannot be recovered.")) return;
        try {
            await api("/v1/me/api-tokens/" + encodeURIComponent(id), { method: "DELETE" });
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to revoke API token.");
        }
    }

    return (
        <Stack spacing={2}>
            <Card variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h6">Create API token</Typography>
                        <Typography variant="body2" color="text.secondary">
                            API tokens are credentials for external clients to read or modify your
                            imshare data. The secret is shown only once when a token is created.
                        </Typography>
                        {secret && (
                            <Alert severity="warning">
                                <Stack spacing={1}>
                                    <Typography>
                                        Copy this token now. It will not be shown again.
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        value={secret}
                                        slotProps={{ input: { readOnly: true } }}
                                    />
                                    <Button
                                        onClick={() => void navigator.clipboard.writeText(secret)}
                                        variant="outlined"
                                    >
                                        Copy token
                                    </Button>
                                </Stack>
                            </Alert>
                        )}
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label="Token name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My CLI"
                            slotProps={{ htmlInput: { maxLength: 100 } }}
                        />
                        <ExpirySelector
                            value={expiry}
                            custom={customExpiry}
                            onChange={setExpiry}
                            onCustomChange={setCustomExpiry}
                        />
                        <Typography variant="subtitle2">Permissions</Typography>
                        <PermissionEditor value={permissions} onChange={setPermissions} />
                        <Button
                            variant="contained"
                            onClick={() => void create()}
                            disabled={busy || !name.trim()}
                        >
                            Create token
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            {error && <Alert severity="error">{error}</Alert>}

            <Stack spacing={1}>
                <Typography variant="h6">Existing tokens</Typography>
                {tokens.map((token) => (
                    <Card key={token.id} variant="outlined">
                        <CardContent>
                            <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                                spacing={2}
                            >
                                <Stack>
                                    <Typography variant="subtitle1">{token.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {token.tokenPrefix}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={token.enabled}
                                                disabled={busyToken === token.id}
                                                onChange={() => void toggleEnabled(token)}
                                            />
                                        }
                                        label={token.enabled ? "Enabled" : "Disabled"}
                                    />
                                    <Button startIcon={<Edit />} onClick={() => openEditor(token)}>
                                        Edit
                                    </Button>
                                    <Button
                                        color="error"
                                        startIcon={<Delete />}
                                        onClick={() => void revoke(token.id)}
                                    >
                                        Revoke
                                    </Button>
                                </Stack>
                            </Stack>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                                Created: {formatDate(token.createdAt)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Last used: {formatDate(token.lastUsedAt)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Expires: {formatDate(token.expiresAt)}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1, overflowWrap: "anywhere" }}>
                                Permissions:{" "}
                                {Object.entries(token.permissions)
                                    .filter(([, values]) => values.length)
                                    .map(
                                        ([resource, values]) => `${resource}: ${values.join(", ")}`,
                                    )
                                    .join(" · ") || "None"}
                            </Typography>
                        </CardContent>
                    </Card>
                ))}
                {tokens.length === 0 && (
                    <Typography color="text.secondary">No API tokens.</Typography>
                )}
            </Stack>

            <Dialog
                open={Boolean(editing)}
                onClose={() => setEditing(null)}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>Edit API Token</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label="Token name"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            slotProps={{ htmlInput: { maxLength: 100 } }}
                        />
                        <ExpirySelector
                            value={editExpiry}
                            custom={editCustomExpiry}
                            onChange={setEditExpiry}
                            onCustomChange={setEditCustomExpiry}
                        />
                        <Typography variant="subtitle2">Permissions</Typography>
                        <PermissionEditor value={editPermissions} onChange={setEditPermissions} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditing(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => void saveEdit()}
                        disabled={busy || !editName.trim()}
                    >
                        Save changes
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
