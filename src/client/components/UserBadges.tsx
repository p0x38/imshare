import { Chip, Stack, Tooltip } from "@mui/material";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import FavoriteOutlinedIcon from "@mui/icons-material/FavoriteOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import type { User } from "../lib/types";

const definitions: Record<string, { label: string; icon: typeof AdminPanelSettingsOutlinedIcon }> = {
    admin: { label: "Admin", icon: AdminPanelSettingsOutlinedIcon },
    moderator: { label: "Moderator", icon: GavelOutlinedIcon },
    veteran: { label: "Veteran", icon: HistoryOutlinedIcon },
    contributor: { label: "Contributor", icon: HandshakeOutlinedIcon },
    verified: { label: "Verified", icon: VerifiedOutlinedIcon },
    "early-adopter": { label: "Early Adopter", icon: HistoryOutlinedIcon },
    "bug-hunter": { label: "Bug Hunter", icon: BugReportOutlinedIcon },
    supporter: { label: "Supporter", icon: FavoriteOutlinedIcon },
    founder: { label: "Founder", icon: EmojiEventsOutlinedIcon },
    developer: { label: "Developer", icon: CodeOutlinedIcon },
    "community-helper": { label: "Community Helper", icon: GroupsOutlinedIcon },
    curator: { label: "Curator", icon: CollectionsBookmarkOutlinedIcon },
};

export function UserBadges({
    user,
    size = "small",
    compact = false,
}: {
    user: Pick<User, "badges">;
    size?: "small" | "medium";
    compact?: boolean;
}) {
    if (!user.badges?.length) return null;
    return (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {user.badges.map((badge) => {
                const definition = definitions[badge];
                if (!definition) return null;
                const Icon = definition.icon;
                return (
                    <Tooltip key={badge} title={definition.label}>
                        <Chip
                            size={size}
                            icon={<Icon />}
                            label={compact ? undefined : definition.label}
                            variant="outlined"
                            aria-label={definition.label}
                            sx={
                                compact
                                    ? {
                                          width: size === "medium" ? 34 : 28,
                                          height: size === "medium" ? 34 : 28,
                                          "& .MuiChip-icon": { margin: 0 },
                                          "& .MuiChip-label": { display: "none" },
                                      }
                                    : undefined
                            }
                        />
                    </Tooltip>
                );
            })}
        </Stack>
    );
}
