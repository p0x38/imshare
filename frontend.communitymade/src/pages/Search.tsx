import { useState } from "react";
import {
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { Search as SearchIcon } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, any[]>>({});
  const [status, setStatus] = useState("");
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    try {
      const r: any = await api(
        `/v1/search?q=${encodeURIComponent(q)}&type=all&limit=25`
      );
      setResults(r.data);
      setStatus(`Results for "${q}"`);
      setSearched(true);
    } catch {
      setStatus("Search failed.");
      setSearched(true);
    }
  };

  const getLink = (type: string, item: any) => {
    if (type === "posts") return `/posts/${encodeURIComponent(item.id)}`;
    if (type === "users") return `/users/${encodeURIComponent(item.id)}`;
    if (type === "tags") return `/tags/${encodeURIComponent(item.id)}`;
    return `/categories/${encodeURIComponent(item.id)}`;
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Search
      </Typography>
      <Card sx={{ mb: 3, p: 2 }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
          <TextField
            size="small"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button type="submit" variant="contained" startIcon={<SearchIcon />}>
            Search
          </Button>
        </form>
      </Card>
      {status && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {status}
        </Typography>
      )}
      {searched &&
        Object.entries(results).map(([type, items]) => (
          <Card key={type} sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ textTransform: "capitalize" }}>
                {type}
              </Typography>
              {items.length === 0 ? (
                <Typography color="text.secondary">No results.</Typography>
              ) : (
                <List dense>
                  {items.map((item: any, i: number) => (
                    <ListItem key={item.id || i} disablePadding>
                      <ListItemButton
                        component={RouterLink}
                        to={getLink(type, item)}
                      >
                        <ListItemText primary={item.name ?? item.title ?? item.id} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        ))}
    </>
  );
}
