(*
 WebHMI HTTPS / PHASE 0: TLS RECORD PROBE
 LAB ONLY. NOT AN HTTPS SERVER. DOES NOT DECRYPT OR SERVE HTTP.
 Source: independent research branch; no writes to machine variables.
 Port 8443. Do not run alongside WebHMI_Server HTTP.
 Copy this BODY into a Program POU called WebHMI_TLS_Probe.
 Import WebHMI_TLS_Probe_LocalVariables.tsv as Internals.
 See README; compilation and hardware compatibility are UNVERIFIED.
*)
IF WebTLS_State = WebTLS_PrevState THEN
    IF (WebTLS_State <> UINT#10) AND (WebTLS_StateTicks < UDINT#4294967290) THEN
        WebTLS_StateTicks := WebTLS_StateTicks + UDINT#1;
    END_IF;
ELSE
    WebTLS_StateTicks := UDINT#0;
    WebTLS_PrevState := WebTLS_State;
END_IF;

(* Finite per-connection timeout, measured in task executions. *)
IF (WebTLS_State <> UINT#10) AND (WebTLS_StateTicks > UDINT#5000) THEN
    WebTLS_Timeouts := WebTLS_Timeouts + UDINT#1;
    WebTLS_State := UINT#90;
END_IF;

CASE WebTLS_State OF
    0:
        WebTLS_Accept(Execute:=FALSE, SrcTcpPort:=UINT#8443, TimeOut:=UINT#0);
        WebTLS_Recv(Execute:=FALSE, Socket:=WebTLS_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=WebTLS_Rx[0]);
        WebTLS_Send(Execute:=FALSE, Socket:=WebTLS_Socket, SendDat:=WebTLS_Tx[0], Size:=UINT#0);
        WebTLS_Close(Execute:=FALSE, Socket:=WebTLS_Socket);
        WebTLS_HeaderCount := UINT#0;
        WebTLS_State := UINT#10;

    10:
        WebTLS_Accept(Execute:=TRUE, SrcTcpPort:=UINT#8443, TimeOut:=UINT#0);
        IF WebTLS_Accept.Done THEN
            WebTLS_Socket := WebTLS_Accept.Socket;
            WebTLS_Accept(Execute:=FALSE, SrcTcpPort:=UINT#8443, TimeOut:=UINT#0);
            WebTLS_Connections := WebTLS_Connections + UDINT#1;
            WebTLS_HeaderCount := UINT#0;
            WebTLS_State := UINT#20;
        ELSIF WebTLS_Accept.Error THEN
            WebTLS_Accept(Execute:=FALSE, SrcTcpPort:=UINT#8443, TimeOut:=UINT#0);
            WebTLS_AcceptErrors := WebTLS_AcceptErrors + UDINT#1;
        END_IF;

    20:
        (* TCP stream: collect a 5-byte TLS record header across multiple receives.
           NEVER interpret raw bytes as HTTP and NEVER write machine variables. *)
        WebTLS_Recv(Execute:=TRUE, Socket:=WebTLS_Socket, TimeOut:=UINT#50, Size:=UINT#512, RcvDat:=WebTLS_Rx[0]);
        IF WebTLS_Recv.Done THEN
            IF WebTLS_Recv.RcvSize > UINT#0 THEN
                FOR WebTLS_Index := UINT#0 TO WebTLS_Recv.RcvSize - UINT#1 DO
                    IF WebTLS_HeaderCount < UINT#5 THEN
                        WebTLS_Hdr[WebTLS_HeaderCount] := WebTLS_Rx[WebTLS_Index];
                        WebTLS_HeaderCount := WebTLS_HeaderCount + UINT#1;
                    END_IF;
                END_FOR;
            END_IF;
            WebTLS_Recv(Execute:=FALSE, Socket:=WebTLS_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=WebTLS_Rx[0]);
            IF WebTLS_HeaderCount = UINT#5 THEN
                WebTLS_RecordLength := BYTE_TO_UINT(WebTLS_Hdr[3]) * UINT#256 + BYTE_TO_UINT(WebTLS_Hdr[4]);
                WebTLS_IsTLS := (WebTLS_Hdr[0] = BYTE#16#16)
                    AND (WebTLS_Hdr[1] = BYTE#16#03)
                    AND (WebTLS_Hdr[2] >= BYTE#16#01)
                    AND (WebTLS_Hdr[2] <= BYTE#16#03)
                    AND (WebTLS_RecordLength > UINT#0)
                    AND (WebTLS_RecordLength <= UINT#16384);
                IF WebTLS_IsTLS THEN
                    WebTLS_RecordCandidates := WebTLS_RecordCandidates + UDINT#1;
                    WebTLS_State := UINT#30;
                ELSE
                    WebTLS_Rejected := WebTLS_Rejected + UDINT#1;
                    WebTLS_State := UINT#90;
                END_IF;
            END_IF;
        ELSIF WebTLS_Recv.Error THEN
            WebTLS_Recv(Execute:=FALSE, Socket:=WebTLS_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=WebTLS_Rx[0]);
            WebTLS_RecvErrors := WebTLS_RecvErrors + UDINT#1;
            WebTLS_State := UINT#90;
        END_IF;

    30:
        (* TLS plaintext fatal alert: handshake_failure, BEFORE any handshake.
           Diagnostic only. This deliberately cannot negotiate a session. *)
        WebTLS_Tx[0] := BYTE#16#15;
        WebTLS_Tx[1] := BYTE#16#03;
        WebTLS_Tx[2] := BYTE#16#03;
        WebTLS_Tx[3] := BYTE#16#00;
        WebTLS_Tx[4] := BYTE#16#02;
        WebTLS_Tx[5] := BYTE#16#02;
        WebTLS_Tx[6] := BYTE#16#28;
        WebTLS_Send(Execute:=TRUE, Socket:=WebTLS_Socket, SendDat:=WebTLS_Tx[0], Size:=UINT#7);
        IF WebTLS_Send.Done OR WebTLS_Send.Error THEN
            WebTLS_Send(Execute:=FALSE, Socket:=WebTLS_Socket, SendDat:=WebTLS_Tx[0], Size:=UINT#0);
            WebTLS_State := UINT#90;
        END_IF;

    90:
        WebTLS_Close(Execute:=TRUE, Socket:=WebTLS_Socket);
        IF WebTLS_Close.Done OR WebTLS_Close.Error THEN
            WebTLS_Close(Execute:=FALSE, Socket:=WebTLS_Socket);
            WebTLS_State := UINT#10;
        END_IF;
    ELSE
        WebTLS_State := UINT#0;
END_CASE;
