import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

interface VersionResponse { data?: { version?: string; commitHash?: string; commitMessage?: string } }

export function Footer() {
    const { t } = useTranslation();
    const [version, setVersion] = useState<VersionResponse["data"]>();
    useEffect(() => { let active = true; void api<VersionResponse>("/v1/version").then((response) => { if (active) setVersion(response.data); }).catch(() => {}); return () => { active = false; }; }, []);
    const buildLabel = version?.commitHash && version.commitHash !== "unknown" ? `${version.commitHash.slice(0, 7)}${version.commitMessage ? ` · ${version.commitMessage}` : ""}` : "";
    return <Box component="footer" sx={{ mt: "auto", borderTop: 1, borderColor: "divider", py: 2 }}>
        <Container maxWidth={false} sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 } }}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" justifyContent="center">
                <Link href="/about/" underline="hover">{t("footer.about")}</Link><Typography color="text.secondary">·</Typography>
                <Link href="/faq/" underline="hover">{t("footer.faq")}</Link><Typography color="text.secondary">·</Typography>
                <Link href="/github/" underline="hover">{t("footer.github")}</Link><Typography color="text.secondary">·</Typography>
                <Link href="/privacy/" underline="hover">{t("footer.privacy")}</Link><Typography color="text.secondary">·</Typography>
                <Link href="/terms/" underline="hover">{t("footer.terms")}</Link>
                <Typography aria-label={t("common.version")} variant="body2" color="text.secondary" title={version?.commitMessage ?? undefined}>{version?.version ? `${t("common.version")} ${version.version}` : t("common.version")}{buildLabel ? ` · ${buildLabel}` : ""}</Typography>
            </Stack>
        </Container>
    </Box>;
}
