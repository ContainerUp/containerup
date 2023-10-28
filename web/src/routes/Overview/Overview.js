import {useEffect, useState} from "react";
import {aioProvider, isConnectError, isDisconnectError} from "../../lib/dataProvidor";
import dataModel from "../../lib/dataModel";
import {showWebsocketDisconnectError} from "../../components/notifications/WebsocketDisconnectError";
import {closeSnackbar, enqueueSnackbar} from "notistack";
import {useNavigate} from "react-router-dom";
import {Doughnut} from "react-chartjs-2";
import {Box, Card, CardContent, Stack, Tooltip} from "@mui/material";
import Typography from "@mui/material/Typography";
import InfoIcon from '@mui/icons-material/Info';
import ContainerUpLearnMore from "../../components/ContainerUpLearnMore";
import StatisticsDataEnds from "../../components/notifications/StatisticsDataEnds";
import showWebsocketConnectError from "../../components/notifications/WebsocketConnectError";

const minPerc = 0.01;
const loadingColor = 'rgb(100, 100, 100)';

const netDesc = "The values are summed up by all containers. Thus inter-container traffics are included, " +
    "but other traffics on the host are excluded.";
const blockDesc = "The values are summed up by all containers. Other disk activities on the host are excluded.";

const makeOptions = (title, unit) => {
    return {
        maintainAspectRatio: false,
        rotation: -90,
        circumference: 180,
        parsing: {
            key: 'val'
        },
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: title,
            },
            tooltip: {
                callbacks: {
                    label: item => {
                        if (item.raw.loading) {
                            return '';
                        }
                        let val = item.raw.raw.toFixed(2);
                        return `${val} ${unit}`;
                    },
                },
            }
        }
    };
};

const makeData = (loading = false) => {
    return {
        labels: [
            'Podman',
            'Other',
            loading ? 'Loading...' : 'Available'
        ],
        datasets: [{
            data: [{val: 0, raw: 0}, {val: 0, raw: 0}, {val: 1, raw: 0, loading}],
            backgroundColor: [
                'rgb(123, 31, 162)',
                'rgb(235,163,54)',
                loading ? loadingColor : 'rgb(220,220,220)'
            ]
        }]
    };
};

export default function Overview() {
    const navigate = useNavigate();

    const [cpuOptions] = useState(() => makeOptions("CPU", "%"));
    const [cpuData, setCpuData] = useState(() => makeData());
    const [memOptions] = useState(() => makeOptions("Memory", "MB"));
    const [memData, setMemData] = useState(() => makeData());

    const [ctn, setCtn] = useState({total: 0, running: 0});
    const [img, setImg] = useState({total: 0, in_use: 0});
    const [net, setNet] = useState({in: 0, out: 0});
    const [block, setBlock] = useState({read: 0, write: 0});
    const [loading, setLoading] = useState(false);
    const [dataCount, setDataCount] = useState(0);

    useEffect(() => {
        const snackbarKeys = [];
        let count = 0;

        let tryConnect = () => {};
        let cancel = () => {};
        let retryTimeout = null;
        let tryCount = 0;
        let disconnectKey = null;

        const onData = data => {
            setLoading(false);
            if (disconnectKey) {
                closeSnackbar(disconnectKey);
                disconnectKey = null;
                tryCount = 0;
            }

            if (!data) {
                snackbarKeys.push(StatisticsDataEnds());
                return;
            }

            count ++;
            setDataCount(c => c + 1);

            {
                const cpu_podman = parseFloat((data.cpu_podman * 100).toFixed(2));
                const cpu_other = parseFloat((data.cpu_other * 100).toFixed(2));
                const cpu_total = data.cpu_total * 100;
                const cpu_idle = cpu_total - cpu_podman - cpu_other;

                const cpuData = makeData(count < 2);
                cpuData.datasets[0].data = [{
                    val: cpu_podman > 0 && cpu_podman < cpu_total * minPerc && count > 1 ? cpu_total * minPerc : cpu_podman,
                    raw: cpu_podman
                }, {
                    val: cpu_other < cpu_total * minPerc && count > 1 ? cpu_total * minPerc : cpu_other,
                    raw: cpu_other
                }, {
                    val: cpu_idle,
                    raw: cpu_idle
                }];
                if (count < 2) {
                    cpuData.datasets[0].data[2].loading = true;
                }
                setCpuData(cpuData);
            }

            {
                const mem_podman = parseFloat((data.mem_podman / 1024 / 1024).toFixed(2));
                const mem_other = parseFloat((data.mem_other / 1024 / 1024).toFixed(2));
                const mem_total = parseFloat((data.mem_total / 1024 / 1024).toFixed(2));
                const mem_idle = mem_total - mem_podman - mem_other;

                const memData = makeData();
                memData.datasets[0].data = [{
                    val: mem_podman > 0 && mem_podman < mem_total * minPerc ? mem_total * minPerc : mem_podman,
                    raw: mem_podman
                }, {
                    val: mem_other < mem_total * minPerc ? mem_total * minPerc : mem_other,
                    raw: mem_other
                }, {
                    val: mem_idle,
                    raw: mem_idle
                }];
                setMemData(memData);
            }

            setCtn({total: data.containers_total, running: data.containers_running});
            setImg({total: data.images_total, in_use: data.images_in_use});
            setNet({
                in: (data.network_in / 1024 / 1024).toFixed(1),
                out: (data.network_out / 1024 / 1024).toFixed(1)
            });
            setBlock({
                read: (data.block_in / 1024 / 1024).toFixed(1),
                write: (data.block_out / 1024 / 1024).toFixed(1)
            });
        };

        const onError = error => {
            setLoading(false);

            if (dataModel.errIsNoLogin(error)) {
                let query = new URLSearchParams();
                query.append('cb', '/overview');
                navigate('/login?' + query.toString());
                return;
            }
            let e = error.toString();
            if (error.response) {
                e = error.response.data;
            }
            if (isDisconnectError(error) || count) {
                // if count > 0, it must be a disconnect err
                if (!disconnectKey) {
                    // do not show multiple disconnect error
                    disconnectKey = showWebsocketDisconnectError();
                }
                retryTimeout = setTimeout(() => {
                    tryConnect();
                    retryTimeout = null;
                }, 1000 * tryCount * tryCount);
            } else {
                if (disconnectKey) {
                    retryTimeout = setTimeout(() => {
                        tryConnect();
                        retryTimeout = null;
                    }, 1000 * tryCount * tryCount);
                } else {
                    // show connect error only when connecting
                    // no retry
                    if (isConnectError(error)) {
                        snackbarKeys.push(showWebsocketConnectError(true));
                    } else {
                        snackbarKeys.push(enqueueSnackbar(e, {
                            variant: "error",
                            persist: true
                        }));
                    }
                }
            }
        };

        tryConnect = () => {
            count = 0;
            cancel = aioProvider().systemStats(onData, onError);
            tryCount ++;
        };

        tryConnect();
        return () => {
            cancel();
            for (const key of snackbarKeys) {
                closeSnackbar(key);
            }
            if (disconnectKey) {
                closeSnackbar(disconnectKey);
                disconnectKey = null;
            }
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [navigate]);

    useEffect(() => {
        document.title = 'ContainerUp - Overview';
    }, []);

    return (
        <Box sx={{width: 800}}>
            <Card>
                <CardContent>
                    <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom align="center">
                        System resources
                    </Typography>

                    <Stack direction="row" sx={{height: 200}}>
                        <Box sx={{width: 350, mr: '68px'}}>
                            <Doughnut
                                options={cpuOptions}
                                data={cpuData}
                            />
                        </Box>


                        <Box sx={{width: 350}}>
                            <Doughnut
                                options={memOptions}
                                data={memData}
                            />
                        </Box>
                    </Stack>
                </CardContent>
            </Card>

            <Stack direction="row" sx={{margin: '16px 0', width: 800}}>
                <Card sx={{width: 188}}>
                    <CardContent>
                        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom align="center">
                            Containers
                        </Typography>
                        <Typography component="div" sx={{lineHeight: 3, display: 'flex'}}>
                            <Box sx={{flexGrow: 1}}>Total:</Box>
                            <Box>{loading ? '...' : ctn.total}</Box>
                        </Typography>
                        <Typography component="div" sx={{lineHeight: 3, display: 'flex'}}>
                            <Box sx={{flexGrow: 1}}>Running:</Box>
                            <Box>{loading ? '...' : ctn.running}</Box>
                        </Typography>
                    </CardContent>
                </Card>

                <Card sx={{ml: '16px', width: 188}}>
                    <CardContent>
                        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom align="center">
                            Images
                        </Typography>

                        <Typography component="div" sx={{lineHeight: 3, display: 'flex'}}>
                            <Box sx={{flexGrow: 1}}>Total:</Box>
                            <Box>{loading ? '...' : img.total}</Box>
                        </Typography>
                        <Typography component="div" sx={{lineHeight: 3, display: 'flex'}}>
                            <Box sx={{flexGrow: 1}}>In use:</Box>
                            <Box>{loading ? '...' : img.in_use}</Box>
                        </Typography>
                    </CardContent>
                </Card>

                <Card sx={{ml: '16px', width: 188}}>
                    <CardContent>
                        <Typography sx={{ fontSize: 14, display: 'flex', justifyContent: 'center' }} color="text.secondary" gutterBottom>
                            Podman Network&nbsp;
                            <Tooltip title={netDesc}>
                                <InfoIcon fontSize="small" />
                            </Tooltip>
                        </Typography>
                        <Typography component="div" sx={{lineHeight: 3, display: 'flex'}}>
                            <Box sx={{flexGrow: 1}}>In:</Box>
                            <Box>{loading || dataCount < 2 ? '...' : net.in} MB/s</Box>
                        </Typography>
                        <Typography component="div" sx={{lineHeight: 3, display: 'flex'}}>
                            <Box sx={{flexGrow: 1}}>Out:</Box>
                            <Box>{loading || dataCount < 2 ? '...' : net.out} MB/s</Box>
                        </Typography>
                    </CardContent>
                </Card>

                <Card sx={{ml: '16px', width: 188}}>
                    <CardContent>
                        <Typography sx={{ fontSize: 14, display: 'flex', justifyContent: 'center' }} color="text.secondary" gutterBottom>
                            Podman Block IO&nbsp;
                            <Tooltip title={blockDesc}>
                                <InfoIcon fontSize="small" />
                            </Tooltip>
                        </Typography>
                        <Typography component="div" sx={{lineHeight: 3, display: 'flex'}}>
                            <Box sx={{flexGrow: 1}}>Read:</Box>
                            <Box>{loading || dataCount < 2 ? '...' : block.read} MB/s</Box>
                        </Typography>
                        <Typography component="div" sx={{lineHeight: 3, display: 'flex'}}>
                            <Box sx={{flexGrow: 1}}>Write:</Box>
                            <Box>{loading || dataCount < 2 ? '...' : block.write} MB/s</Box>
                        </Typography>
                    </CardContent>
                </Card>
            </Stack>

            <ContainerUpLearnMore variant="long" />
        </Box>

    );
}