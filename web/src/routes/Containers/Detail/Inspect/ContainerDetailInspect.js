import {useOutletContext} from "react-router-dom";
import {Fragment, useMemo} from "react";
import {Alert, Paper, Skeleton} from "@mui/material";

export default function ContainerDetailInspect() {
    const {container, loading, errMsg} = useOutletContext();
    const inspectData = useMemo(() => {
        return JSON.stringify(container, null, 4);
    }, [container]);

    return (
        <>
            {!loading && !errMsg && (
                <Paper
                    component="pre"
                    sx={{fontSize: '12px', padding: '4px', margin: 0}}
                >
                    {inspectData}
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
        </>
    );
}