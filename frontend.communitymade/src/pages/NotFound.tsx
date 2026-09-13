import { Card, CardContent, Typography, Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

interface NotFoundProps {
  status?: number;
  title?: string;
  message?: string;
}

export default function NotFound({
  status = 404,
  title = "Page not found",
  message = "The page you requested does not exist.",
}: NotFoundProps) {
  return (
    <Card sx={{ maxWidth: 480, mx: "auto", mt: 8, textAlign: "center" }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h2" color="text.secondary" gutterBottom>
          {status}
        </Typography>
        <Typography variant="h5" gutterBottom>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {message}
        </Typography>
        <Button variant="contained" component={RouterLink} to="/">
          Back to imshare
        </Button>
      </CardContent>
    </Card>
  );
}
