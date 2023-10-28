import {
    Paper,
    Table,
    TableBody,
    TableContainer,
    TableHead,
    TableRow
} from "@mui/material";
import MyTableRowsLoader from "../../../components/MyTableRowsLoader";
import MyTableRowSingle from "../../../components/MyTableRowSingle";
import Link from "@mui/material/Link";
import {Link as RouterLink} from "react-router-dom";
import sizeUtil from "../../../lib/sizeUtil";
import ImageActions from "./ImageActions";
import CreatedAt from "../../../components/CreatedAt";
import ImageRepo from "./ImageRepo";
import {ResponsiveTableCell as TableCell} from "../../../components/ReponsiveTableCell";
import {useImageListStore} from "./store";

export default function ImagesTable() {
    const loading = useImageListStore(state => state.loading);
    const isErr = useImageListStore(state => !state.images);

    const imgd = useImageListStore(state => {
        const imagesData = state.images;
        if (imagesData === null) {
            return [];
        }

        const ret = [];
        for (const img of imagesData) {
            img.idShort = img.Id.substring(0, 12);
            img.sizeHuman = sizeUtil.humanReadableSize(img.Size);

            let hasTag = false;
            if (Array.isArray(img.Names)) {
                for (const repoTag of img.Names) {
                    const parts = repoTag.split(':');
                    let [repo, tag] = ['', ''];
                    if (parts.length === 2) {
                        [repo, tag] = parts;
                    } else {
                        [repo] = parts;
                        tag = '<none>';
                    }
                    ret.push({
                        ...img,
                        repo,
                        tag,
                        nameOrId: repoTag
                    });
                    hasTag = true;
                }
            }

            if (!hasTag) {
                ret.push({
                    ...img,
                    repo: '<none>',
                    tag: '<none>',
                    nameOrId: img.idShort
                });
            }
        }

        return ret;
    });

    return (
        <TableContainer component={Paper} sx={{maxHeight: "calc(100vh - 96px)"}}>
            <Table stickyHeader aria-label="images table">
                <TableHead>
                    <TableRow>
                        <TableCell>Image ID</TableCell>
                        <TableCell>Repository</TableCell>
                        <TableCell>Tag</TableCell>
                        <TableCell>Created At</TableCell>
                        <TableCell>Containers</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell>Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loading && (
                        <MyTableRowsLoader rows={3} cols={7} sx={{height: '72px'}} />
                    )}

                    {isErr && (
                        <MyTableRowSingle cols={7}>
                            ❌ Error occurred.
                        </MyTableRowSingle>
                    )}

                    {!isErr && !loading && !imgd.length && (
                        <MyTableRowSingle cols={7}>
                            No image found. Pull one?
                        </MyTableRowSingle>
                    )}

                    {!isErr && !loading && imgd.map(img => (
                        <TableRow key={img.repo + ':' + img.tag + '@' + img.Id}>
                            <TableCell>
                                <Link component={RouterLink} to={img.idShort}>
                                    {img.idShort}
                                </Link>
                            </TableCell>

                            <TableCell>
                                <ImageRepo repo={img.repo} />
                            </TableCell>

                            <TableCell>
                                {img.tag}
                            </TableCell>

                            <TableCell>
                                <CreatedAt createdUnixTimestamp={img.Created} />
                            </TableCell>

                            <TableCell>
                                {img.Containers}
                            </TableCell>

                            <TableCell>
                                {img.sizeHuman[0]} {img.sizeHuman[1]}
                            </TableCell>

                            <TableCell>
                                <ImageActions image={img} />
                            </TableCell>
                        </TableRow>
                    ))}

                </TableBody>
            </Table>
        </TableContainer>
    );
}