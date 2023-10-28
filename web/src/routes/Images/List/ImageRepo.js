import Link from "@mui/material/Link";
import LaunchIcon from '@mui/icons-material/Launch';
import {useMemo} from "react";

const repoMatcher = [{
    regex: /^docker\.io\/([^/]+)\/(.+)$/,
    func: match => {
        const user = match[1] === 'library' ? '_' : match[1];
        return `https://hub.docker.com/${user}/${match[2]}`;
    }
}, {
    regex: /^ghcr\.io\/.+$/,
    func: match => {
        return `https://${match[0]}`;
    }
}, {
    regex: /^public.ecr.aws\/([^/]+)\/(.+)$/,
    func: match => {
        return `https://gallery.ecr.aws/${match[1]}/${match[2]}`;
    }
}, {
    regex: /^quay.io\/.+$/,
    func: match => {
        return `https://${match[0]}`;
    }
}];

export default function ImageRepo({repo}) {
    const url = useMemo(() => {
        for (const item of repoMatcher) {
            const match = repo.match(item.regex);
            if (match) {
                return item.func(match);
            }
        }
        return '';
    }, [repo]);

    return (
        <div style={{display: "flex"}}>
            <div>{repo}</div>
            {url && (
                <Link component="a" href={url} sx={{ml: 1}} target="_blank">
                    <LaunchIcon fontSize="small" />
                </Link>
            )}
        </div>
    );
}