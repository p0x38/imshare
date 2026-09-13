import { Typography, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";

const faqs = [
  {
    q: "What is imshare?",
    a: "imshare is a self-hosted image archive and sharing application.",
  },
  {
    q: "Who can access my images?",
    a: "That depends on how the server is configured and where you publish links. Image creators can also disable downloads for individual posts.",
  },
  {
    q: "Can I delete my comments?",
    a: "Yes. Comment authors can remove their own comments, and image owners can remove comments from their posts.",
  },
  {
    q: "How do reports work?",
    a: "Signed-in users can report posts or comments for review. Reports are stored for the server administrator to handle.",
  },
];

export default function Faq() {
  return (
    <>
      <Typography variant="h4" gutterBottom>
        Frequently asked questions
      </Typography>
      {faqs.map((faq, i) => (
        <Accordion key={i} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{faq.q}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>{faq.a}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </>
  );
}
