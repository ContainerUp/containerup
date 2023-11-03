import MyAppBar from "../components/MyAppBar";
import MyDrawer from "../components/MyDrawer";
import MyDrawerItem from "../components/MyDrawerItem";
import List from "@mui/material/List";
import {useEffect, useState} from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import StorageIcon from '@mui/icons-material/Storage';
import AlbumIcon from '@mui/icons-material/Album';
import Divider from "@mui/material/Divider";
import SettingsIcon from '@mui/icons-material/Settings';
import {Outlet, useNavigate, useOutlet} from "react-router-dom";
import MyContent from "../components/MyContent";
import {Badge, Box} from "@mui/material";
import AppBarButtons from "./AppBarButtons";
import AppBarBreadcrumb from "./AppBarBreadcrumb";
import {SnackbarProvider} from "notistack";
import {useGA4} from "../lib/ga4";
import {doBackgroundUpdateCheck, useUpdateState} from "./System/updateStore";

export default function Root() {
    useGA4();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const handleDrawerOpen = () => {
        setDrawerOpen(true);
    };
    const handleDrawerClose = () => {
        setDrawerOpen(false);
    };

    const outlet = useOutlet();
    const navigate = useNavigate();
    useEffect(() => {
        if (!outlet) {
            navigate('/overview');
        }
    }, [navigate, outlet]);

    useEffect(() => {
        const cancel = doBackgroundUpdateCheck();
        return () => cancel();
    });

    const hasUpdate = useUpdateState(state => !!state.update);

    return (
        <>
            <Box sx={{ display: 'flex' }}>
                <MyAppBar drawerOpen={drawerOpen} onOpen={handleDrawerOpen}>
                    <AppBarBreadcrumb />
                    <AppBarButtons />
                </MyAppBar>
                <MyDrawer open={drawerOpen} onClose={handleDrawerClose}>
                    <List>
                        <MyDrawerItem
                            text="Overview"
                            drawerOpen={drawerOpen}
                            icon={<DashboardIcon />}
                            path='/overview'
                        />
                        <MyDrawerItem
                            text="Containers"
                            drawerOpen={drawerOpen}
                            icon={<StorageIcon />}
                            path='/containers'
                            or={['/containers_create']}
                        />
                        <MyDrawerItem
                            text="Images"
                            drawerOpen={drawerOpen}
                            icon={<AlbumIcon />}
                            path='/images'
                        />
                        <Divider />
                        <MyDrawerItem
                            text="System"
                            drawerOpen={drawerOpen}
                            icon={
                                <Badge color="warning" variant="dot" invisible={!hasUpdate}>
                                    <SettingsIcon />
                                </Badge>
                            }
                            path='/system'
                        />
                        <MyDrawerItem
                            text="Logout"
                            drawerOpen={drawerOpen}
                            icon={<LogoutIcon />}
                            path='/logout'
                        />
                    </List>
                </MyDrawer>

                <MyContent>
                    <SnackbarProvider />
                    <Outlet />
                </MyContent>
            </Box>
        </>
    );
}