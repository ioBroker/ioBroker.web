import React from 'react';

import { IconButton, Snackbar } from '@mui/material';

import { MdClose as IconClose } from 'react-icons/md';

import { I18n } from '@iobroker/gui-components';

interface ToastProps {
    message: string;
    onClose: () => void;
}

export function Toast(props: ToastProps): React.JSX.Element | null {
    const { message, onClose } = props;
    if (!message) {
        return null;
    }
    return (
        <Snackbar
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
            }}
            open
            autoHideDuration={6000}
            onClose={onClose}
            slotProps={{ content: { 'aria-describedby': 'message-id' } }}
            message={<span id="message-id">{I18n.t(message)}</span>}
            action={[
                <IconButton
                    key="close"
                    aria-label="Close"
                    color="inherit"
                    onClick={onClose}
                >
                    <IconClose />
                </IconButton>,
            ]}
        />
    );
}
