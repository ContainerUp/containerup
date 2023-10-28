import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {Alert, Paper, Skeleton} from "@mui/material";
import dataModel from "../../lib/dataModel";
import {Fragment} from "react";
import {getController} from "../../lib/HostGuestController";
import ContainerUpLearnMore from "../../components/ContainerUpLearnMore";

export default function SystemInfo() {
    const [errMsg, setErrMsg] = useState('');
    const navigate = useNavigate();
    const [infoData, setInfoData] = useState('');

    const [loading, setLoading] = useState(true);


    useEffect(() => {
        if (!loading) {
            return;
        }

        const ac = new AbortController();
        dataModel.systemInfo(ac)
            .then(resp => {
                const str = JSON.stringify(resp, null, 4);
                setInfoData(str);
            })
            .catch(error => {
                if (ac.signal.aborted) {
                    return;
                }
                if (dataModel.errIsNoLogin(error)) {
                    let query = new URLSearchParams();
                    query.append('cb', '/info');
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
    }, [loading, navigate]);

    useEffect(() => {
        const ctrl = getController('bar_breadcrumb');
        const unregister = ctrl.asControllerGuest([{text: 'System Info'}]);
        return () => unregister();
    }, []);

    useEffect(() => {
        document.title = 'ContainerUp - System Info';
    }, []);

    return (
        <>
            {!loading && !errMsg && (
                <Paper
                    component="pre"
                    sx={{fontSize: '12px', padding: '4px', margin: 0}}
                >
                    {infoData}
                </Paper>
            )}

            {loading && (
                <Paper
                    sx={{fontSize: '12px', padding: '4px', margin: 0}}
                >
                    {[...Array(10)].map((row, i) => (
                        <Fragment key={i}>
                            <Skeleton animation="wave" sx={{width: '35%'}} />
                            <Skeleton animation="wave" sx={{width: '45%'}} />
                            <Skeleton animation="wave" sx={{width: '55%'}} />
                        </Fragment>
                    ))}
                </Paper>
            )}

            {!!errMsg && (
                <Alert severity="error">
                    {errMsg}
                </Alert>
            )}

            <ContainerUpLearnMore />
        </>
    );
}