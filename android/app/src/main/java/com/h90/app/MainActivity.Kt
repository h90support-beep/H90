package com.h90.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.h90.app.security.H90SecurityPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(H90SecurityPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}