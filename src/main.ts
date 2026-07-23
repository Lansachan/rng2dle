import { createApp } from 'vue'
import App from './App.vue'
import RulesDesigner from './views/RulesDesigner.vue'
import './style.css'

const rootComponent = window.location.pathname === '/tools/rules' ? RulesDesigner : App

createApp(rootComponent).mount('#app')
