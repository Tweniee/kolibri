import { convertKeysToCamelCase, convertKeysToSnakeCase } from 'kolibri.coreVue.vuex.mappers';
import samePageCheckGenerator from 'kolibri.utils.samePageCheckGenerator';
import { FacilityResource, FacilityDatasetResource } from 'kolibri.resources';
import ConditionalPromise from 'kolibri.lib.conditionalPromise';
import { PageNames, defaultFacilityConfig, notificationTypes } from '../../constants';
import preparePage from './helpers/preparePage';

// Utility that wraps the ubiquitous "don't resolve if not on same page" logic.
// The `_promise` property is accessed because the thenable returned by
// ConditionalPromise does not chain with `catch` in the expected way
function resolveOnlyIfOnSamePage(promises, store) {
  const ident = x => x;
  return ConditionalPromise.all(promises).only(samePageCheckGenerator(store), ident, ident)
    ._promise;
}

function showNotification(store, notificationType) {
  store.commit('CONFIG_PAGE_NOTIFY', notificationType);
}

export function showFacilityConfigPage(store) {
  const FACILITY_ID = store.state.core.session.facility_id;
  preparePage(store.commit, {
    name: PageNames.FACILITY_CONFIG_PAGE,
    title: 'Configure Facility',
  });
  const resourceRequests = [
    FacilityResource.getModel(FACILITY_ID).fetch(),
    FacilityDatasetResource.getCollection({ facility_id: FACILITY_ID }).fetch(),
  ];

  return resolveOnlyIfOnSamePage(resourceRequests, store)
    .then(function onSuccess([facility, facilityDatasets]) {
      const dataset = facilityDatasets[0]; // assumes for now is only one facility being managed
      store.commit('SET_PAGE_STATE', {
        facilityDatasetId: dataset.id,
        facilityName: facility.name,
        // this part of state is mutated as user interacts with form
        settings: convertKeysToCamelCase(dataset),
        // this copy is kept for the purpose of undoing if save fails
        settingsCopy: convertKeysToCamelCase(dataset),
        notification: null,
      });
      store.commit('CORE_SET_PAGE_LOADING', false);
    })
    .catch(function onFailure() {
      store.commit('SET_PAGE_STATE', {
        facilityName: '',
        settings: null,
        notification: notificationTypes.PAGELOAD_FAILURE,
      });
      store.commit('CORE_SET_PAGE_LOADING', false);
    });
}

export function saveFacilityConfig(store) {
  showNotification(store, null);
  const { facilityDatasetId, settings } = store.state.pageState;
  const resourceRequests = [
    FacilityDatasetResource.getModel(facilityDatasetId).save(convertKeysToSnakeCase(settings)),
  ];
  return resolveOnlyIfOnSamePage(resourceRequests, store)
    .then(function onSuccess() {
      showNotification(store, notificationTypes.SAVE_SUCCESS);
      store.commit('CONFIG_PAGE_COPY_SETTINGS');
    })
    .catch(function onFailure() {
      showNotification(store, notificationTypes.SAVE_FAILURE);
      store.commit('CONFIG_PAGE_UNDO_SETTINGS_CHANGE');
    });
}

export function resetFacilityConfig(store) {
  store.commit('CONFIG_PAGE_MODIFY_ALL_SETTINGS', defaultFacilityConfig);
  return saveFacilityConfig(store);
}
