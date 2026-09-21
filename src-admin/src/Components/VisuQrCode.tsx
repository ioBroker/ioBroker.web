import React, { Component } from 'react';
import QRCode from 'qrcode';

import { Box, Button, CircularProgress } from '@mui/material';
import { QrCode2 as IconQrCode } from '@mui/icons-material';

import { I18n, InfoBox, type AdminConnection } from '@iobroker/gui-components';

import { buildVisuPayload } from './visuPayload';
import type { WebAdapterConfig } from '../types';

interface VisuQrCodeProps {
    socket: AdminConnection;
    native: WebAdapterConfig;
    /** Number of this web instance */
    instance: number;
    /** Host this instance runs on, like `raspberrypi` */
    host: string;
    /** Unsaved changes in the configuration: the app would connect with the saved ones */
    changed: boolean;
}

interface VisuQrCodeState {
    /** The rendered QR code */
    svg: string;
    /** Instance the credentials come from, like `cloud.0` */
    source: string;
    error: string;
    working: boolean;
}

/**
 * QR code the ioBroker.visu app reads the connection from.
 *
 * It carries the addresses and the port of this web instance for the local network, and the ioBroker.pro
 * credentials of a cloud or iot instance for the access from outside. Without such an instance the code is
 * still offered - the app then only reaches this server in the local network.
 */
export class VisuQrCode extends Component<VisuQrCodeProps, VisuQrCodeState> {
    constructor(props: VisuQrCodeProps) {
        super(props);
        this.state = { svg: '', source: '', error: '', working: false };
    }

    async buildQrCode(): Promise<void> {
        const { native, socket, instance, host } = this.props;
        // The app signs in with the credentials above, which it cannot do on a server asking for SSL as well
        if (native.auth && native.secure) {
            this.setState({ error: 'visu_qr_error_ssl' });
            return;
        }

        this.setState({ working: true, error: '', source: '' });
        try {
            const { payload, source } = await buildVisuPayload(socket, native, instance, host);
            const svg = await QRCode.toString(payload, {
                type: 'svg',
                width: 256,
                margin: 1,
                errorCorrectionLevel: 'H',
            });
            this.setState({ svg, source, working: false });
        } catch (e) {
            this.setState({ working: false, error: (e as Error).message || String(e) });
        }
    }

    render(): React.JSX.Element {
        const { svg, source, error, working } = this.state;

        return (
            <Box
                component="div"
                style={{ marginTop: 20, maxWidth: 600 }}
            >
                {this.props.changed ? (
                    <InfoBox
                        type="info"
                        style={{ marginBottom: 10 }}
                    >
                        {I18n.t('visu_qr_save_first')}
                    </InfoBox>
                ) : null}
                {svg ? null : (
                    <Button
                        variant="outlined"
                        disabled={working || this.props.changed}
                        startIcon={working ? <CircularProgress size={16} /> : <IconQrCode />}
                        onClick={() => void this.buildQrCode()}
                    >
                        {I18n.t('visu_qr_show')}
                    </Button>
                )}
                {error ? (
                    <InfoBox
                        type="warning"
                        style={{ marginTop: 10 }}
                    >
                        {I18n.t(error)}
                    </InfoBox>
                ) : null}
                {svg ? (
                    <>
                        <div
                            title={I18n.t('visu_qr_hide')}
                            style={{ width: 256, cursor: 'pointer' }}
                            onClick={() => this.setState({ svg: '' })}
                            dangerouslySetInnerHTML={{ __html: svg }}
                        />
                        <div style={{ marginTop: 10 }}>{I18n.t('visu_qr_scan')}</div>
                        {source ? (
                            <div style={{ opacity: 0.7 }}>{I18n.t('visu_qr_credentials', source)}</div>
                        ) : (
                            <InfoBox
                                type="info"
                                style={{ marginTop: 10 }}
                            >
                                {I18n.t('visu_qr_no_cloud')}
                            </InfoBox>
                        )}
                    </>
                ) : null}
            </Box>
        );
    }
}
