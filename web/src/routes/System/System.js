import {Link, Outlet, useLocation, useNavigate} from "react-router-dom";
import {useEffect, useMemo, useState} from "react";
import {Box, Tab, Tabs} from "@mui/material";
import dataModel from "../../lib/dataModel";

const tabs = [{
    to: "update",
    label: "Update"
}, {
    to: "info",
    label: "info"
}];

const tabsMap = {};
tabs.forEach((t, i) => {
    tabsMap[t.to] = i;
});

export default function System() {
    const location = useLocation();
    const navigate = useNavigate();

    // if pathname is like /system then redirect to `upgrade`
    const [tabVal, tabValValid] = useMemo(() => {
        const parts = location.pathname.split('/');
        // "", "system", "upgrade"
        if (parts.length < 3) {
            return [0, false];
        }

        let ret = tabsMap[parts[2]];
        if (ret !== undefined) {
            return [ret, true];
        }
        return [0, false];
    }, [location]);

    useEffect(() => {
        if (!tabValValid) {
            navigate(tabs[0].to);
        }
    }, [tabValValid, navigate]);

    const [infoData, setInfoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg] = useState('');

    useEffect(() => {
        if (!loading) {
            return;
        }

        const ac = new AbortController();
        dataModel.systemInfo(ac)
            .then(resp => {
                setInfoData(resp);
            })
            .catch(error => {
                if (ac.signal.aborted) {
                    return;
                }
                if (dataModel.errIsNoLogin(error)) {
                    let query = new URLSearchParams();
                    query.append('cb', location.pathname + location.search);
                    navigate('/login?' + query.toString());
                    return;
                }
                let e = error.toString();
                if (error.response) {
                    e = error.response.data;
                }
                setErrMsg(e);
            })
            .finally(() => {
                if (ac.signal.aborted) {
                    return;
                }
                setLoading(false);
            });

        return () => ac.abort();
    }, [loading, navigate, location]);

    if (!tabValValid) {
        return (<></>);
    }

    return (
        <>
            <Box sx={{ width: '100%', marginBottom: '16px' }}>
                <Tabs value={tabVal} aria-label="system tabs">
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

            <Outlet context={{infoData, loading, errMsg}} />
        </>
    );
}