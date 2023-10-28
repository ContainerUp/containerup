import {Box, Tab, Tabs} from "@mui/material";
import {Link, Outlet, useLocation, useNavigate, useParams} from "react-router-dom";
import {useEffect, useMemo, useState} from "react";
import {getController} from "../../../lib/HostGuestController";
import {aioProvider, isDisconnectError} from "../../../lib/dataProvidor";
import dataModel from "../../../lib/dataModel";
import {showWebsocketDisconnectError} from "../../../components/notifications/WebsocketDisconnectError";
import {closeSnackbar} from "notistack";

const tabs = [{
    to: "overview",
    label: "Overview"
}, {
    to: "inspect",
    label: "Inspect"
}, {
    to: "logs",
    label: "Logs"
}, {
    to: "exec",
    label: "Exec"
}, {
    to: "statistics",
    label: "Statistics"
},
// {
//     to: "settings",
//     label: "Settings"
// }
];

const tabsMap = {};
tabs.forEach((t, i) => {
    tabsMap[t.to] = i;
});

export default function ContainerDetail() {
    const {containerId} = useParams();
    const {pathname} = useLocation();

    // if pathname is like /containers/0abcde3333 then redirect to overview
    const [tabVal, tabValValid] = useMemo(() => {
        const parts = pathname.split('/');
        // "", "containers", "0abcde3333", "overview"
        if (parts.length < 4) {
            return [0, false];
        }

        let ret = tabsMap[parts[3]];
        if (ret !== undefined) {
            return [ret, true];
        }
        return [0, false];
    }, [pathname]);

    const navigate = useNavigate();

    useEffect(() => {
        if (!tabValValid) {
            navigate('overview');
        }
    }, [tabValValid, navigate]);

    useEffect(() => {
        const ctrl = getController('bar_breadcrumb');
        const unregister = ctrl.asControllerGuest([{
            text: 'Containers',
            href: '/containers'
        }, {
            text: containerId
        }]);
        return () => unregister();
    }, [containerId]);

    useEffect(() => {
        document.title = 'ContainerUp - Container ' + containerId;
    }, [containerId]);

    useEffect(() => {
        const ctrl = getController('bar_button');
        const unregister = ctrl.asControllerGuest('container_detail_buttons');
        return () => unregister();
    }, []);

    const [container, setContainer] = useState({Id: containerId});
    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg] = useState('');

    useEffect(() => {
        const ctrl = getController('container_detail_buttons');
        const unregister = ctrl.asControllerGuest(container);
        return () => unregister();
    }, [container]);

    useEffect(() => {
        let count = 0;

        let tryConnect = () => {};
        let cancel = () => {};
        let retryTimeout = null;
        let tryCount = 0;
        let disconnectKey = null;

        const onData = d => {
            setContainer(d);
            setLoading(false);

            if (disconnectKey) {
                closeSnackbar(disconnectKey);
                disconnectKey = null;
                tryCount = 0;
            }
            count ++;
        };

        const onError = error => {
            if (dataModel.errIsNoLogin(error)) {
                let query = new URLSearchParams();
                query.append('cb', pathname);
                navigate('/login?' + query.toString());
                return;
            }
            let e = error.toString();
            if (error.response) {
                e = error.response.data;
            }
            if (loading) {
                setErrMsg(e);
                setLoading(false);
            } else {
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
                        setErrMsg(e);
                    }
                }
            }
        };

        tryConnect = () => {
            count = 0;
            cancel = aioProvider().container(containerId, onData, onError);
            tryCount ++;
        };

        tryConnect();
        return () => {
            cancel();
            if (disconnectKey) {
                closeSnackbar(disconnectKey);
                disconnectKey = null;
            }
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [containerId, loading, navigate, pathname]);

    return (
        <>
            {tabValValid && (
                <>
                    <Box sx={{ width: '100%', marginBottom: '16px' }}>
                        <Tabs value={tabVal} aria-label="container tabs">
                            {tabs.map(t => (
                                <Tab
                                    key={t.to}
                                    component={Link}
                                    label={t.label}
                                    to={t.to}
                                />
                            ))}
                        </Tabs>
                    </Box>

                    <Outlet context={{container, loading, errMsg}} />
                </>
            )}
        </>
    );
}