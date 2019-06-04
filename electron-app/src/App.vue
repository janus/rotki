<template>
  <v-app id="rotkehlchen">
    <v-navigation-drawer
      v-model="drawer"
      fixed
      :clipped="$vuetify.breakpoint.mdAndUp"
      class="grey lighten-4"
      app
    >
      <div class="text-center">
        <img
          id="rotkehlchen_no_text"
          :src="require('./assets/images/rotkehlchen_no_text.png')"
          class="rounded"
          alt=""
        />
      </div>
      <div id="welcome_text" class="text-center"></div>
      <navigation-menu></navigation-menu>
    </v-navigation-drawer>
    <v-toolbar app fixed clipped-left>
      <v-toolbar-side-icon @click="drawer = !drawer"></v-toolbar-side-icon>
      <v-toolbar-title class="font-weight-light">Rotkehlchen</v-toolbar-title>

      <ul class="nav navbar-top-links navbar-status-icons">
        <ul class="list-group lg-status-icons">
          <node-status></node-status>
          <li class="list-group-item balance-save-status">
            <a class="balances-saved-status-link" href="#">
              <i class="fa fa-save fa-fw"></i>
            </a>
            <ul class="dropdown-menu dropdown-balance-save-status">
              <p>
                Balances last saved:<br />
                <span id="last_balance_save_field">Never</span>
              </p>
            </ul>
          </li>
        </ul>
      </ul>
      <v-spacer></v-spacer>
      <ul class="nav navbar-top-links navbar-right">
        <li class="dropdown">
          <a
            id="notification-badge"
            class="dropdown-toggle"
            data-toggle="dropdown"
            href="#"
          >
            <i class="fa fa-bell fa-fw"></i>
            <i class="fa fa-caret-down"></i>
            <span class="badge">0</span>
          </a>
          <ul id="notification-messages" class="dropdown-menu"></ul>
        </li>

        <li class="dropdown">
          <a class="dropdown-toggle" data-toggle="dropdown" href="#">
            <i
              id="top-loading-icon"
              class="fa fa-circle-o-notch fa-spin fa-fw"
            ></i>
            <i class="fa fa-caret-down"></i>
          </a>
          <ul class="dropdown-menu dropdown-tasks"></ul>
        </li>

        <user-dropdown></user-dropdown>
        <currency-drop-down></currency-drop-down>
      </ul>
    </v-toolbar>
    <v-content v-if="userLogged">
      <router-view></router-view>
    </v-content>
    <confirmation
      v-if="logout"
      @confirm="logoutUser()"
      @cancel="cancelLogout()"
    ></confirmation>
    <message-dialog
      v-if="error"
      title="Login Failed"
      :message="error"
      @dismiss="ok()"
    ></message-dialog>
    <login
      :displayed="!userLogged && !error"
      @login="login($event)"
      @new-account="newAccount = true"
    ></login>
    <create-account
      :displayed="newAccount"
      @cancel="newAccount = false"
      @confirm="createAccount($event)"
    ></create-account>
    <sync-permission
      :displayed="permissionNeeded !== ''"
      :message="permissionNeeded"
    ></sync-permission>
  </v-app>
</template>

<script lang="ts">
import './legacy/renderer';
import { Component, Vue } from 'vue-property-decorator';
import UserDropdown from '@/components/UserDropdown.vue';
import NavigationMenu from '@/components/NavigationMenu.vue';
import CurrencyDropDown from '@/components/CurrencyDropDown.vue';
import Confirmation from '@/components/Confirmation.vue';
import { mapState } from 'vuex';
import { reset_pages, settings } from '@/legacy/settings';
import { reset_total_balances } from '@/legacy/balances_table';
import { reset_tasks } from '@/legacy/monitor';
import { reset_exchange_tables } from '@/legacy/exchange';
import { reset_user_settings } from '@/legacy/user_settings';
import { create_or_reload_dashboard } from '@/legacy/dashboard';
import Login from '@/components/Login.vue';
import { AccountData, Credentials } from '@/typing/types';
import { handleUnlockResult } from '@/legacy/userunlock';
import MessageDialog from '@/components/dialogs/MessageDialog.vue';
import CreateAccount from '@/components/CreateAccount.vue';
import { UnlockResult } from '@/model/action-result';
import SyncPermission from '@/components/dialogs/SyncPermission.vue';
import { monitor } from '@/services/monitoring';
import NodeStatus from '@/components/status/NodeStatus.vue';

@Component({
  components: {
    NodeStatus,
    SyncPermission,
    CreateAccount,
    MessageDialog,
    Login,
    Confirmation,
    CurrencyDropDown,
    NavigationMenu,
    UserDropdown
  },
  computed: mapState(['logout', 'userLogged'])
})
export default class App extends Vue {
  logout!: boolean;
  userLogged!: boolean;

  newAccount: boolean = false;
  drawer = true;

  permissionNeeded: string = '';
  error: string = '';

  private accountData?: AccountData;

  get visibleModal(): boolean {
    return this.logout;
  }

  created() {
    this.$rpc.connect();
  }

  ok() {
    this.error = '';
    this.permissionNeeded = '';
  }

  confirmSync() {
    const accountData = this.accountData;
    if (!accountData) {
      throw new Error('no stored account');
    }
    this.$rpc
      .unlock_user(
        accountData.username,
        accountData.password,
        true,
        'yes',
        accountData.apiKey,
        accountData.apiSecret
      )
      .then(unlockResult => {
        this.$store.commit('newUser', true);
        handleUnlockResult(unlockResult);
      })
      .catch((reason: Error) => {
        this.error = reason.message;
      });
  }

  cancelSync() {
    const accountData = this.accountData;
    if (!accountData) {
      throw new Error('no stored account');
    }
    this.$rpc
      .unlock_user(
        accountData.username,
        accountData.password,
        true,
        'no',
        accountData.apiKey,
        accountData.apiSecret
      )
      .then(unlockResult => {
        this.$store.commit('newUser', true);
        handleUnlockResult(unlockResult);
      })
      .catch((reason: Error) => {
        this.error = reason.message;
      });
  }

  async login(credentials: Credentials) {
    this.$rpc
      .unlock_user(credentials.username, credentials.password)
      .then(unlockResult => this.completeLogin(unlockResult))
      .catch((reason: Error) => {
        this.error = reason.message;
      });
  }

  private completeLogin(unlockResult: UnlockResult, accountData?: AccountData) {
    this.newAccount = false;
    if (!unlockResult.result) {
      if (unlockResult.permission_needed) {
        this.permissionNeeded = unlockResult.message;
        this.accountData = accountData;
      } else {
        this.error = unlockResult.message;
      }
      return;
    }

    handleUnlockResult(unlockResult);
  }

  async createAccount(accountData: AccountData) {
    this.$rpc
      .unlock_user(
        accountData.username,
        accountData.password,
        true,
        'unknown',
        accountData.apiKey,
        accountData.apiSecret
      )
      .then(unlockResult => {
        this.$store.commit('newUser', true);
        this.completeLogin(unlockResult, accountData);
      })
      .catch((reason: Error) => {
        this.error = reason.message;
      });
  }

  logoutUser() {
    this.$rpc
      .logout()
      .then(() => {
        $('#welcome_text').html('');
        settings.reset();
        reset_total_balances();
        reset_pages();
        reset_tasks();
        reset_exchange_tables();
        reset_user_settings();
        $('#page-wrapper').html('');
        create_or_reload_dashboard();
        monitor.stop();
        this.$store.commit('logout', false);
        this.$store.commit('logged', false);
      })
      .catch((reason: Error) => {
        console.log(`Error at logout`);
        console.error(reason);
      });
  }

  cancelLogout() {
    this.$store.commit('logout', false);
  }
}
</script>

<style lang="scss">
@import '~datatables.net-dt/css/jquery.dataTables.min.css';
</style>