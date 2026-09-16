import {
    Alert,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    Link,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import ApiIcon from "@mui/icons-material/Api";
import Article from "@mui/icons-material/Article";
import Code from "@mui/icons-material/Code";
import Gavel from "@mui/icons-material/Gavel";
import GitHub from "@mui/icons-material/GitHub";
import Hub from "@mui/icons-material/Hub";
import Image from "@mui/icons-material/Image";
import Info from "@mui/icons-material/Info";
import OpenInNew from "@mui/icons-material/OpenInNew";
import Security from "@mui/icons-material/Security";
import Storage from "@mui/icons-material/Storage";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";

const REPOSITORY_URL = "https://github.com/p0x38/imshare";
const CONTRIBUTING_URL = `${REPOSITORY_URL}/blob/main/CONTRIBUTING.md`;
const README_URL = `${REPOSITORY_URL}/blob/main/README.md`;
const ENDPOINTS_URL = `${REPOSITORY_URL}/blob/main/endpoints.md`;
const PUBLIC_ENDPOINTS_URL = `${REPOSITORY_URL}/blob/main/public-endpoints.md`;
const COMMITS_URL = `${REPOSITORY_URL}/commits/main/`;

function SectionCard({
    icon: Icon,
    title,
    children,
}: {
    icon: typeof Info;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Icon color="primary" />
                        <Typography variant="h6" component="h2">
                            {title}
                        </Typography>
                    </Stack>
                    {children}
                </Stack>
            </CardContent>
        </Card>
    );
}

function ActionLink({
    href,
    children,
    variant = "outlined",
}: {
    href: string;
    children: React.ReactNode;
    variant?: "contained" | "outlined" | "text";
}) {
    return (
        <Button
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            variant={variant}
            endIcon={<OpenInNew />}
        >
            {children}
        </Button>
    );
}

function AboutPage({ ja }: { ja: boolean }) {
    return (
        <Page maxWidth="md" title={ja ? "imshareについて" : "About imshare"}>
            <Stack spacing={2.5}>
                <Stack spacing={1}>
                    <Typography variant="h3" component="h1">
                        {ja ? "imshareについて" : "About imshare"}
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                        {ja
                            ? "自分で管理できる画像アーカイブと共有サーバー。"
                            : "A self-hosted image archive and sharing server you control."}
                    </Typography>
                    <Typography color="text.secondary">
                        {ja
                            ? "imshareは、画像・投稿・アカウント・モデレーションなどを1つのサーバーで管理するためのオープンソースプロジェクトです。"
                            : "imshare is an open-source project for running images, posts, accounts, moderation, and public discovery on your own server."}
                    </Typography>
                </Stack>

                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <GitHub />
                                <Typography variant="h6" component="h2">
                                    {ja ? "ソースコード" : "Source code"}
                                </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                {ja
                                    ? "このサイトで使われているimshare本体はGitHubで公開されています。IssueやPull Requestもこちらから確認できます。"
                                    : "The imshare application powering this site is maintained publicly on GitHub. Issues, pull requests, documentation, and source history are available there."}
                            </Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <ActionLink href={REPOSITORY_URL} variant="contained">
                                    {ja ? "GitHubリポジトリを開く" : "Open GitHub repository"}
                                </ActionLink>
                                <ActionLink href={README_URL}>
                                    README
                                </ActionLink>
                                <ActionLink href={CONTRIBUTING_URL}>
                                    {ja ? "コントリビュート" : "Contributing"}
                                </ActionLink>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>

                <Stack spacing={2}>
                    <SectionCard icon={Image} title={ja ? "画像と投稿" : "Images and posts"}>
                        <Typography variant="body2" color="text.secondary">
                            {ja
                                ? "画像アップロード、サムネイル、説明、キャプション、タグ、カテゴリ、リアクション、コメント、レポートなどを投稿単位で扱えます。"
                                : "Posts can contain images and metadata such as captions, descriptions, tags, categories, reactions, comments, and reports, with generated image derivatives handled by the server."}
                        </Typography>
                    </SectionCard>
                    <SectionCard icon={Storage} title={ja ? "セルフホスト" : "Self-hosting"}>
                        <Typography variant="body2" color="text.secondary">
                            {ja
                                ? "Node.js、pnpm、SQLiteを中心とした構成で、自分のストレージと設定を管理できます。設定はimshare独自のconfig.imshare形式で記述します。"
                                : "The current stack uses Node.js, pnpm, and SQLite, with a native config.imshare configuration format so operators can manage storage and instance behavior themselves."}
                        </Typography>
                    </SectionCard>
                    <SectionCard icon={Security} title={ja ? "アカウントとモデレーション" : "Accounts and moderation"}>
                        <Typography variant="body2" color="text.secondary">
                            {ja
                                ? "Better Authによる認証、ユーザープロフィール、モデレーター・管理者向けの権限分離、レポートやモデレーション機能があります。"
                                : "Authentication is provided through Better Auth, with profiles and separate user, moderator, and administrator permissions for supported moderation operations."}
                        </Typography>
                    </SectionCard>
                    <SectionCard icon={Hub} title={ja ? "フェデレーション" : "Federation"}>
                        <Typography variant="body2" color="text.secondary">
                            {ja
                                ? "ActivityPubベースのフェデレーション機能を備え、WebFinger、Actor、Inbox/Outbox、フォロー、投稿の連携などを実装しています。"
                                : "The server includes ActivityPub-oriented federation functionality including WebFinger, actors, inbox/outbox handling, follows, and federated public posts."}
                        </Typography>
                    </SectionCard>
                    <SectionCard icon={ApiIcon} title={ja ? "APIと公開エンドポイント" : "API and public endpoints"}>
                        <Typography variant="body2" color="text.secondary">
                            {ja
                                ? "APIはバージョン付きの/v1配下で提供され、公開ページとは分離されたAPIドキュメントも用意されています。"
                                : "The browser-facing API is versioned under /v1, with separate endpoint references for the complete API surface and public endpoints."}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <ActionLink href="/docs/" variant="contained">
                                {ja ? "APIドキュメント" : "API documentation"}
                            </ActionLink>
                            <ActionLink href={PUBLIC_ENDPOINTS_URL}>
                                {ja ? "公開エンドポイント" : "Public endpoints"}
                            </ActionLink>
                        </Stack>
                    </SectionCard>
                </Stack>

                <SectionCard icon={Code} title={ja ? "開発" : "Development"}>
                    <List disablePadding>
                        {[
                            ja
                                ? "TypeScript / React / Material UIを使った現在のフロントエンド"
                                : "Current frontend built with TypeScript, React, and Material UI",
                            ja
                                ? "Fastifyを中心としたNode.jsバックエンド"
                                : "Node.js backend centered around Fastify",
                            ja
                                ? "PrismaとSQLiteによるデータ永続化"
                                : "Data persistence with Prisma and SQLite",
                            ja
                                ? "Vitest、統合テスト、Playwrightを含むチェック体制"
                                : "Checks covering Vitest, integration tests, and Playwright browser tests",
                        ].map((item) => (
                            <ListItem key={item} disableGutters>
                                <ListItemText primary={item} />
                            </ListItem>
                        ))}
                    </List>
                </SectionCard>
            </Stack>
        </Page>
    );
}

function GitHubPage({ ja }: { ja: boolean }) {
    return (
        <Page maxWidth="md" title={ja ? "GitHub" : "GitHub"}>
            <Stack spacing={2.5}>
                <Stack spacing={1}>
                    <Typography variant="h3" component="h1">
                        GitHub
                    </Typography>
                    <Typography color="text.secondary">
                        {ja
                            ? "imshareプロジェクトのソースコード、Issue、Pull Request、履歴を確認できます。"
                            : "Source, issues, pull requests, and development history for the imshare project."}
                    </Typography>
                </Stack>
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <GitHub fontSize="large" />
                                <Stack>
                                    <Typography variant="h5" component="h2">
                                        p0x38/imshare
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {ja ? "プロジェクトリポジトリ" : "Project repository"}
                                    </Typography>
                                </Stack>
                            </Stack>
                            <Typography color="text.secondary">
                                {ja
                                    ? "README、設定例、API仕様、テスト、ドキュメント、ソースコードはこのリポジトリで管理されています。"
                                    : "The repository contains the source code, README, configuration examples, API documentation, tests, and supporting project documentation."}
                            </Typography>
                            <Link
                                href={REPOSITORY_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                sx={{ overflowWrap: "anywhere", fontFamily: "monospace" }}
                            >
                                {REPOSITORY_URL}
                            </Link>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <ActionLink href={REPOSITORY_URL} variant="contained">
                                    {ja ? "リポジトリを開く" : "Open repository"}
                                </ActionLink>
                                <ActionLink href={COMMITS_URL}>
                                    {ja ? "コミット履歴" : "Commit history"}
                                </ActionLink>
                                <ActionLink href={CONTRIBUTING_URL}>
                                    {ja ? "参加する" : "Contribute"}
                                </ActionLink>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>
                <SectionCard icon={Article} title={ja ? "プロジェクトドキュメント" : "Project documentation"}>
                    <List disablePadding>
                        {[
                            [README_URL, "README.md", ja ? "セットアップ、機能、構成、開発情報" : "Setup, features, architecture, and development"],
                            [CONTRIBUTING_URL, "CONTRIBUTING.md", ja ? "開発・テスト・Pull Requestのガイド" : "Development, testing, and pull request guidance"],
                            [ENDPOINTS_URL, "endpoints.md", ja ? "APIエンドポイントのリファレンス" : "Complete API endpoint reference"],
                        ].map(([href, label, description]) => (
                            <ListItem key={label} disableGutters>
                                <ListItemText
                                    primary={<Link href={href} target="_blank" rel="noopener noreferrer">{label}</Link>}
                                    secondary={description}
                                />
                            </ListItem>
                        ))}
                    </List>
                </SectionCard>
                <Alert severity="info">
                    {ja
                        ? "imshareのGitHubリポジトリはこのページの主要な開発情報源です。"
                        : "The imshare GitHub repository is the primary public source for project development information."}
                </Alert>
            </Stack>
        </Page>
    );
}

function PrivacyPage({ ja }: { ja: boolean }) {
    return (
        <Page maxWidth="md" title={ja ? "プライバシー" : "Privacy"}>
            <Stack spacing={2.5}>
                <Stack spacing={1}>
                    <Typography variant="h3" component="h1">
                        {ja ? "プライバシー" : "Privacy"}
                    </Typography>
                    <Typography color="text.secondary">
                        {ja
                            ? "このページはimshareインスタンスで考慮すべきプライバシー情報をまとめています。"
                            : "This page describes the privacy considerations for an imshare instance."}
                    </Typography>
                </Stack>
                <Alert severity="warning">
                    {ja
                        ? "実際のデータ保存期間、管理者のアクセス範囲、ログ、バックアップ、外部サービスの利用状況は、インスタンス運営者の設定とポリシーによって異なる場合があります。"
                        : "Actual retention periods, administrator access, logging, backups, and third-party services can vary according to the operator's configuration and policies."}
                </Alert>
                <SectionCard icon={Info} title={ja ? "保存される可能性がある情報" : "Information that may be stored"}>
                    <Typography variant="body2" color="text.secondary">
                        {ja
                            ? "アカウント情報、プロフィール情報、投稿とアップロード、コメント・リアクション・通知・レポートなど、サービス提供に必要なデータが保存される場合があります。"
                            : "Depending on enabled features, the service may store account and profile information, posts and uploads, comments, reactions, notifications, reports, and other data required to provide the service."}
                    </Typography>
                </SectionCard>
                <SectionCard icon={Security} title={ja ? "認証とアクセス" : "Authentication and access"}>
                    <Typography variant="body2" color="text.secondary">
                        {ja
                            ? "認証された機能はサーバー側で権限が確認されます。公開ページと管理ページではアクセスできる情報が異なります。"
                            : "Authenticated features are authorized on the server. Public, account, and administrator areas can expose different information and operations."}
                    </Typography>
                </SectionCard>
                <SectionCard icon={Hub} title={ja ? "フェデレーション" : "Federation"}>
                    <Typography variant="body2" color="text.secondary">
                        {ja
                            ? "フェデレーションを有効にしている場合、公開投稿やアクティビティが他のサーバーへ送信・保存される可能性があります。公開コンテンツは、相手側サーバーの保持方針にも依存します。"
                            : "When federation is enabled, public activities and content may be sent to and stored by other servers. Public content can therefore be subject to the retention and privacy practices of remote instances."}
                    </Typography>
                </SectionCard>
                <SectionCard icon={Code} title={ja ? "解析・外部サービス" : "Analytics and third-party services"}>
                    <Typography variant="body2" color="text.secondary">
                        {ja
                            ? "管理者はGoogle Analytics 4やGoogle Tag Managerを設定できます。これらが有効かどうかはインスタンスの設定によります。"
                            : "Administrators can configure Google Analytics 4 and Google Tag Manager. Whether these services are enabled depends on the instance configuration."}
                    </Typography>
                </SectionCard>
            </Stack>
        </Page>
    );
}

function TermsPage({ ja }: { ja: boolean }) {
    return (
        <Page maxWidth="md" title={ja ? "利用規約" : "Terms"}>
            <Stack spacing={2.5}>
                <Stack spacing={1}>
                    <Typography variant="h3" component="h1">
                        {ja ? "利用規約" : "Terms of Service"}
                    </Typography>
                    <Typography color="text.secondary">
                        {ja
                            ? "このページは、このimshareインスタンスを利用する際の基本的なルールを案内します。"
                            : "These terms outline the baseline rules for using this imshare instance."}
                    </Typography>
                </Stack>
                <Alert severity="info">
                    {ja
                        ? "インスタンス固有の追加ルールや管理者からの案内がある場合は、それらもあわせて確認してください。"
                        : "Instance-specific rules or administrator notices may add requirements beyond these baseline terms."}
                </Alert>
                <SectionCard icon={Info} title={ja ? "適切な利用" : "Appropriate use"}>
                    <Typography variant="body2" color="text.secondary">
                        {ja
                            ? "アカウント、投稿、コメント、APIなどは、サービスの運営を妨げない範囲で利用してください。法令やインスタンス固有のルールに反する利用は禁止される場合があります。"
                            : "Use accounts, posts, comments, and APIs in a way that does not interfere with the service. Applicable law and instance-specific rules may prohibit certain uses."}
                    </Typography>
                </SectionCard>
                <SectionCard icon={Article} title={ja ? "投稿コンテンツ" : "User content"}>
                    <Typography variant="body2" color="text.secondary">
                        {ja
                            ? "投稿するコンテンツについて、必要な権利や許可を利用者自身が確認してください。公開投稿は、検索・キャッシュ・フェデレーションなどによって別の場所でも扱われる可能性があります。"
                            : "Users are responsible for ensuring they have the necessary rights or permissions for content they submit. Public content may be indexed, cached, or distributed through federation."}
                    </Typography>
                </SectionCard>
                <SectionCard icon={Gavel} title={ja ? "モデレーション" : "Moderation"}>
                    <Typography variant="body2" color="text.secondary">
                        {ja
                            ? "管理者・モデレーターは、サービスの安全性や運営上の理由から、対応可能なモデレーション機能を使用することがあります。"
                            : "Administrators and moderators may use the available moderation tools for safety, policy enforcement, and operational reasons."}
                    </Typography>
                </SectionCard>
                <SectionCard icon={Security} title={ja ? "アカウントの保護" : "Account security"}>
                    <Typography variant="body2" color="text.secondary">
                        {ja
                            ? "認証情報を安全に管理し、第三者に共有しないでください。アカウント上で不審な動作に気づいた場合は、インスタンス運営者へ連絡してください。"
                            : "Keep your authentication credentials secure and do not share them with third parties. Report suspicious account activity to the instance operator."}
                    </Typography>
                </SectionCard>
                <SectionCard icon={GitHub} title={ja ? "ソフトウェアとライセンス" : "Software and licensing"}>
                    <Typography variant="body2" color="text.secondary">
                        {ja
                            ? "imshareのソースコードとライセンス情報はGitHubリポジトリで確認できます。インスタンス上の投稿コンテンツや設定は、ソフトウェア本体とは別に扱われます。"
                            : "The imshare source and license information are available in the GitHub repository. Content and instance configuration are separate from the software itself."}
                    </Typography>
                    <ActionLink href={REPOSITORY_URL}>
                        {ja ? "GitHubで確認" : "View on GitHub"}
                    </ActionLink>
                </SectionCard>
            </Stack>
        </Page>
    );
}

function StaticPages() {
    const { i18n } = useTranslation();
    const ja = i18n.language === "ja";
    const page = document.body.dataset.staticPage ?? "about";

    switch (page) {
        case "github":
            return <GitHubPage ja={ja} />;
        case "privacy":
            return <PrivacyPage ja={ja} />;
        case "terms":
            return <TermsPage ja={ja} />;
        default:
            return <AboutPage ja={ja} />;
    }
}

const root = document.querySelector("#static-pages");
if (root)
    createRoot(root).render(
        <App>
            <StaticPages />
        </App>,
    );
