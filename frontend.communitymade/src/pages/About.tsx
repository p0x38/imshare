import { Typography, Card, CardContent } from "@mui/material";

export default function About() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h4" gutterBottom>
          About imshare
        </Typography>
        <Typography>
          imshare is a self-hosted image archive and sharing server.
        </Typography>
        <Typography sx={{ mt: 1 }}>
          This instance is powered by the imshare API.
        </Typography>
      </CardContent>
    </Card>
  );
}
