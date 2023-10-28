import {useOutletContext} from "react-router-dom";
import MyDataTable from "../../../../components/MyDataTable";
import {useMemo} from "react";
import {Alert, Box, Chip, Skeleton, Stack} from "@mui/material";
import ContainerStatus from "../../ContainerStatus";
import timeUtil from "../../../../lib/timeUtil";
import sizeUtil from "../../../../lib/sizeUtil";
import CreatedAt from "../../../../components/CreatedAt";

const dataKeys = [
    {
        label: "Short ID",
        loadingFunc: resp => resp.Id.substring(0, 12),
        dataFunc: resp => resp.Id.substring(0, 12)
    },
    {
        label: "Long ID",
        dataFunc: resp => resp.Id
    },
    {
        label: "Container name",
        dataFunc: resp => resp.Name
    },
    {
        label: "Image name",
        dataFunc: resp => resp.ImageName
    },
    {
        label: "Image ID",
        dataFunc: resp => resp.Image
    },
    {
        label: "Created At",
        dataFunc: resp => {
            return (
                <>
                    {resp.Created && (
                        <CreatedAt created3339Nano={resp.Created} />
                    )}
                </>
            );
        }
    },
    {
        label: "Status",
        dataFunc: resp => {
            return (
                <>
                    {resp.State && (
                        <ContainerStatus
                            state={resp.State.Status}
                            exitCode={resp.State.ExitCode}
                            exitAt={timeUtil.parseRFC3339Nano(resp.State.FinishedAt)}
                            startedAt={timeUtil.parseRFC3339Nano(resp.State.StartedAt)}
                        />
                    )}
                </>
            );
        }
    },
    {
        label: 'Working directory',
        dataFunc: resp => resp.Config?.WorkingDir
    },
    {
        label: "Entrypoint",
        dataFunc: resp => resp.Config?.Entrypoint
    },
    {
        label: "Command",
        dataFunc: resp => {
            if (!resp.Config || !resp.Config.Cmd) {
                return '';
            }
            return (
                <Stack direction="row" spacing={0.5}>
                    {resp.Config.Cmd.map((v, i) => (
                        <Chip label={v} key={i} size="small" />
                    ))}
                </Stack>
            );
        }
    },{
        label: "Ports",
        dataFunc: resp => {
            const ports = [];
            if (resp.HostConfig && resp.HostConfig.PortBindings) {
                const pb = resp.HostConfig.PortBindings;
                Object.keys(pb).forEach(key => {
                    pb[key]?.forEach(h => {
                        let ip = '0.0.0.0';
                        if (h.HostIp) {
                            ip = h.HostIp;
                        }
                        ports.push(`${ip}:${h.HostPort}->${key}`);
                    });
                });
            }
            return (
                <Stack>
                    {ports.map((p, i) => (
                        <Box key={i}>
                            {p}
                        </Box>
                    ))}
                </Stack>
            );
        }
    },{
        label: "Size",
        dataFunc: resp => {
            if (!resp.SizeRootFs && !resp.SizeRw) {
                return (
                    <>
                        <span>
                            Not calculated
                        </span>

                        {/*<Tooltip title="Calculate">*/}
                        {/*    <IconButton aria-label="caculate" color="primary" size="small">*/}
                        {/*        <TroubleshootIcon />*/}
                        {/*    </IconButton>*/}
                        {/*</Tooltip>*/}
                    </>
                );
            }
            return (
                <>
                    {sizeUtil.humanReadableSize(resp.SizeRw)}
                    {' '}
                    (virtual {sizeUtil.humanReadableSize(resp.SizeRootFs)})
                </>
            );
        },
        valueSx: {padding: '12px 16px'}
    }
];

const loadingEl = (<Skeleton animation="wave" variant="text" sx={{maxWidth: "480px"}}/>);

const populateTableData = (resp, loading) => {
    const d = [];
    dataKeys.forEach(row => {
        let v = loadingEl;
        if (loading && row.loadingFunc) {
            v = row.loadingFunc(resp);
        }
        if (!loading && row.dataFunc) {
            v = row.dataFunc(resp);
        }
        d.push({label: row.label, value: v, valueSx: row.valueSx});
    });
    return d;
};

export default function ContainerDetailOverview() {
    const {container, loading, errMsg} = useOutletContext();
    const tableData = useMemo(() => {
        return populateTableData(container, loading);
    }, [container, loading]);

    return (
        <>
            {!errMsg && (
                <MyDataTable data={tableData} />
            )}

            {!!errMsg && (
                <Alert severity="error">
                    {errMsg}
                </Alert>
            )}
        </>
    );
}