import { useState } from "react";
import {
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/v1/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          registrationToken: token.trim(),
        }),
      });
      if (res.ok) {
        await refresh();
        navigate("/dashboard/");
      } else {
        const payload = await res.json().catch(() => null);
        setError(
          payload?.error?.message ?? payload?.message ?? "Registration failed."
        );
      }
    } catch {
      setError("Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 480, mx: "auto" }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Create account
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextField
            label="Name"
            fullWidth
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Must contain at least one uppercase letter.
          </Typography>
          <TextField
            label="Registration access token"
            fullWidth
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Ask the server owner for the current registration token. It rotates
            every 12 hours.
          </Typography>
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
          >
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
        <Typography sx={{ mt: 2, textAlign: "center" }}>
          Already registered?{" "}
          <Link component={RouterLink} to="/account/login/">
            Log in
          </Link>
        </Typography>
      </CardContent>
    </Card>
  );
}
