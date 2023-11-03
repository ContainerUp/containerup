import MyTerminalTwoWay from "../../components/MyTerminalTwoWay";
import TwoWayPipe from "../../lib/TwoWayPipe";
import DoUpdate, {UpdateFatalError} from "./updater";
import {useEffect} from "react";
import term from "../../lib/termUtil";
import {useSearchParams} from "react-router-dom";

export default function UpdateTerminal({image, currentVersion, targetVersion, onSuccess, onError, onFailure}) {
    const [searchParams] = useSearchParams();

    const dataPipe = new TwoWayPipe();
    const dataSide = dataPipe.useLeft();
    const xtWriter = dataSide.useWriter();

    useEffect(() => {
        const ab = new AbortController();
        const skipPulling = searchParams.get("skip_pulling");

        DoUpdate(xtWriter, image, skipPulling === '1', ab)
            .then(resp => {
                const version = resp.version;
                xtWriter({type: 'data', data: term.yellow(`Previous version: ${currentVersion}, current version: ${version}, target version: ${targetVersion}`) + term.crlf});

                let failure = false;
                if (version === currentVersion) {
                    xtWriter({type: 'data', data: term.yellow('Current version hasn\'t been changed.' + term.crlf)});
                    failure = true;
                }
                if (version !== targetVersion) {
                    xtWriter({type: 'data', data: term.yellow('Current version doesn\'t match target version.' + term.crlf)});
                    failure = true;
                }
                if (failure) {
                    xtWriter({type: 'data', data: term.red('Update failed.' + term.crlf)});
                    onError();
                } else {
                    xtWriter({type: 'data', data: term.green('Update succeeded.' + term.crlf)});
                    onSuccess();
                }
            })
            .catch(error => {
                if (ab.signal.aborted) {
                    return;
                }
                if (error instanceof UpdateFatalError) {
                    onFailure();
                    return;
                }
                xtWriter({type: 'data', data: term.red(error.toString())});
                onError();
            });

        return () => {
            ab.abort();
        };
    });

    return (
        <MyTerminalTwoWay
            dataSide={dataPipe.useRight()}
        />
    );
}