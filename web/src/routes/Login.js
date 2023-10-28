import TextField from '@mui/material/TextField';
import LoadingButton from '@mui/lab/LoadingButton';
import Typography from "@mui/material/Typography";
import MyAppBar from "../components/MyAppBar";

import {useEffect, useState} from "react";
import dataModel from '../lib/dataModel';
import {Container, Alert} from "@mui/material";
import {useNavigate, useSearchParams} from "react-router-dom";
import AlertTitle from "@mui/material/AlertTitle";
import {grey} from "@mui/material/colors";
import ContainerUpLearnMore from "../components/ContainerUpLearnMore";
import {useGA4} from "../lib/ga4";
import {enqueueSnackbar, SnackbarProvider} from "notistack";

let defaultUsername = '';
let defaultPassword = '';
if (process.env.REACT_APP_CONTAINERUP_DEMO) {
    defaultUsername = 'demo';
    defaultPassword = 'demo';
}

export default function Login() {
    useGA4();

    const [username, setUsername] = useState(defaultUsername);
    const [password, setPassword] = useState(defaultPassword);
    const [loading, setLoading] = useState(false);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const handleSubmit = event => {
        event.preventDefault();
        setLoading(true);
        dataModel.login(username, password)
            .then(() => {
                let to = '/';
                const cb = searchParams.get('cb');
                if (cb) {
                    to = cb;
                }
                navigate(to);
            })
            .catch(error => {
                let e = error.toString();
                if (error.response) {
                    if (error.response.status === 401) {
                        e = "Incorrect username or password";
                    }
                }
                enqueueSnackbar(e, {
                    variant: 'error'
                });
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        document.title = 'ContainerUp - Login';
        if (process.env.REACT_APP_CONTAINERUP_DEMO) {
            document.title = 'ContainerUp Demo - Login';
        }
    }, []);

    return (
        <>
            <MyAppBar drawerOpen={false}>
                <Typography variant="h6" noWrap component="div">
                    ContainerUp
                </Typography>
            </MyAppBar>

            <SnackbarProvider />

            <Container maxWidth="xs" sx={{marginTop: '96px'}}>
                <form onSubmit={handleSubmit}>
                    <h2>
                        Login
                    </h2>
                    <TextField
                        label="Username"
                        required
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        fullWidth
                        size="small"
                        margin="normal"
                        autoFocus
                    />
                    <TextField
                        label="Password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        type="password"
                        fullWidth
                        size="small"
                        margin="normal"
                    />
                    <LoadingButton
                        type="submit"
                        variant="outlined"
                        loading={loading}
                        sx={{marginTop: '16px'}}
                    >
                        <span>Submit</span>
                    </LoadingButton>
                </form>

                {process.env.REACT_APP_CONTAINERUP_DEMO && (
                    <>
                        <Alert severity="info" sx={{mt: '15px'}}>
                            <AlertTitle>Demo server</AlertTitle>
                            Feel free to explore all the features!
                        </Alert>

                        <ContainerUpLearnMore />
                    </>
                )}

                <Typography sx={{mt: '15px', color: grey[400]}} variant="caption">
                    Version {process.env.REACT_APP_CONTAINERUP_VERSION} Build {process.env.REACT_APP_CONTAINERUP_BUILD} Commit {process.env.REACT_APP_CONTAINERUP_COMMIT}
                </Typography>
            </Container>

        </>
    );
}