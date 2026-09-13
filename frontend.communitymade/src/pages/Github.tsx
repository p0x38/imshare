import { Typography, Card, CardContent } from "@mui/material";

export default function Github() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h4" gutterBottom>
          imshare on GitHub
        </Typography>
        <Typography>
          imshare is developed as a self-hosted image archive and sharing server.
        </Typography>
        <Typography sx={{ mt: 1 }}>
          The project repository is private at the moment. This application uses
          AI-assisted development in parts of its implementation and documentation.
        </Typography>
      </CardContent>
    </Card>
  );
}
