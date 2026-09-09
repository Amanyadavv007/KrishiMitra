package com.krishimitra.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private static final int PERM_REQUEST_CODE = 4711;
  private static boolean permissionsRequested = false;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Ask for the runtime permissions the website's features need ONCE at
    // startup (crop-scan camera, GPS weather, voice assistant). Every
    // permission has a graceful denied-path inside the web app, so a
    // refusal never blocks usage and can never crash the app.
    if (!permissionsRequested) {
      permissionsRequested = true;
      String[] wanted = {
        Manifest.permission.CAMERA,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.RECORD_AUDIO
      };
      requestIfNeeded(wanted);
    }
  }

  private void requestIfNeeded(String[] permissions) {
    boolean anyMissing = false;
    for (String p : permissions) {
      if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
        anyMissing = true;
        break;
      }
    }
    if (anyMissing) {
      ActivityCompat.requestPermissions(this, permissions, PERM_REQUEST_CODE);
    }
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    // Pass through to Capacitor plugin handlers, then intentionally ignore
    // the outcomes: the site degrades gracefully for every denial.
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
  }
}
