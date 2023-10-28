import {
    Box,
    Paper, Stack,
    Table,
    TableBody,
    TableContainer,
    TableHead,
    TableRow
} from "@mui/material";
import MyTableRowsLoader from "../../../components/MyTableRowsLoader";
import MyTableRowSingle from "../../../components/MyTableRowSingle";

import Link from '@mui/material/Link';
import {Link as RouterLink} from "react-router-dom";
import ContainerStatus from "../ContainerStatus";
import ContainerActions from "./ContainerActions";
import CreatedAt from "../../../components/CreatedAt";
import {ResponsiveTableCell as TableCell} from "../../../components/ReponsiveTableCell";
import {useContainerListStore} from "./store";

export default function ContainersTable() {
    const loading = useContainerListStore(state => state.loading);
    const isErr = useContainerListStore(state => !state.containers);
    const cd = useContainerListStore(state => {
        const containersData = state.containers;
        if (containersData === null) {
            return [];
        }
        return containersData.map(c => {
            c.idShort = c.Id.substring(0, 12);

            c.ports = [];
            if (c.Ports) {
                c.Ports.forEach(p => {
                    let ip = '0.0.0.0';
                    if (p.host_ip) {
                        ip = p.host_ip;
                    }
                    c.ports.push({
                        ip,
                        host_port: p.host_port,
                        container_port: p.container_port,
                        protocol: p.protocol
                    });
                });
            }

            c.canStart = c.State === 'exited' || c.State === 'created';
            c.canStop = c.State === 'running';
            c.canExec = c.State === 'running';
            c.canDelete = c.State === 'exited' || c.State === 'created';

            return c;
        });
    });

    return (
        <TableContainer component={Paper} sx={{maxHeight: "calc(100vh - 96px)"}}>
            <Table stickyHeader aria-label="containers table">
                <TableHead>
                    <TableRow>
                        <TableCell>Container ID</TableCell>
                        <TableCell>Names</TableCell>
                        <TableCell>Image</TableCell>
                        <TableCell>Ports</TableCell>
                        <TableCell>Created At</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loading && (
                        <MyTableRowsLoader rows={3} cols={7} sx={{height: '72px'}} />
                    )}

                    {isErr && !cd.length && (
                        <MyTableRowSingle cols={7}>
                            ❌ Error occurred.
                        </MyTableRowSingle>
                    )}

                    {!isErr && !loading && !cd.length && (
                        <MyTableRowSingle cols={7}>
                            No container found. Create one?
                        </MyTableRowSingle>
                    )}

                    {!isErr && !loading && cd.map(c => (
                        <TableRow key={c.Id}>
                            <TableCell>
                                <Link component={RouterLink} to={c.idShort + '/overview'}>
                                    {c.idShort}
                                </Link>
                            </TableCell>

                            <TableCell>
                                {c.Names[0]}
                            </TableCell>

                            <TableCell>
                                {c.Image}
                            </TableCell>

                            <TableCell>
                                <Stack>
                                    {c.ports.map((p, i) => (
                                        <Box key={i} sx={{display: 'flex', flexWrap: 'wrap'}}>
                                            <div>{p.ip}:{p.host_port}</div>
                                            <div>->{p.container_port}/{p.protocol}</div>
                                        </Box>
                                    ))}
                                </Stack>
                            </TableCell>

                            <TableCell>
                                <CreatedAt created3339Nano={c.Created} />
                            </TableCell>

                            <TableCell>
                                <ContainerStatus
                                    state={c.State}
                                    exitCode={c.ExitCode}
                                    exitAt={c.ExitedAt}
                                    startedAt={c.StartedAt}
                                />
                            </TableCell>

                            <TableCell>
                                <ContainerActions c={c} />
                            </TableCell>
                        </TableRow>
                    ))}

                </TableBody>
            </Table>
        </TableContainer>
    );
}