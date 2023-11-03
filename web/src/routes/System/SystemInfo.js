import {useEffect} from "react";
import {useOutletContext} from "react-router-dom";
import {Alert, Paper, Skeleton} from "@mui/material";
import {Fragment} from "react";
import {getController} from "../../lib/HostGuestController";
import ContainerUpLearnMore from "../../components/ContainerUpLearnMore";

export default function SystemInfo() {
    const {infoData, loading, errMsg} = useOutletContext();
    const infoJson = JSON.stringify(infoData, null, 4);

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
                    {infoJson}
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