import { useEffect, useState } from 'react';
import AppSidebar from './AppSidebar';
import { circulationAPI } from '../services/api';
import { buildLocalDueDatePreview, today } from '../utils/loanPreview';

const SETTINGS_SECTIONS = [
  { id: 'due-dates', label: 'Due Dates', title: 'Automated Due Dates', description: 'Loan period rules and due date preview tools.' },
  { id: 'cataloging', label: 'Cataloging', title: 'Cataloging & Metadata Standards', description: 'Keep records consistent across the catalog.' },
  { id: 'privacy', label: 'Privacy', title: 'Patron Privacy & Security', description: 'Privacy, access, and account lifecycle controls.' },
  { id: 'notifications', label: 'Notifications', title: 'Notification & Communication Logic', description: 'Control timing, templates, and delivery channels.' },
  { id: 'opac', label: 'OPAC', title: 'OPAC Display Settings', description: 'Tune public search behavior and discovery settings.' }
];

const MANDATORY_FIELDS = ['ISBN', 'Title', 'Author', 'Language', 'Publisher', 'Classification'];
const FACET_FILTERS = ['Year', 'Branch', 'Language', 'Format', 'Author', 'Availability'];
const PERMISSION_LEVELS = ['Super Admin', 'Staff', 'Volunteer', 'Read-Only'];

const defaultSettings = {
  dueDates: {
    renewalLimit: '2',
    hardDueDateEnabled: false,
    hardDueDate: '',
    holdRequestLimit: '5',
    gracePeriodDays: '2',
    reminderBeforeDays: '3',
    reminderOnDueDate: true,
    reminderAfterDays: '1',
    comingDueBookDays: '3',
    comingDueDvdDays: '1',
    comingDueAudiobookDays: '2',
    bookDailyFineRate: '0.10',
    dvdDailyFineRate: '1.00',
    audiobookDailyFineRate: '0.50',
    maxFineCap: '25.00',
    holidayExclusionEnabled: true,
    sundayBlackout: true,
    holidayCalendarName: 'Library Holidays',
    seasonalRuleEnabled: false,
    seasonalRuleName: 'Semester End',
    seasonalRuleDate: '',
    patronTierMode: 'Student',
    studentBookLoanDays: '21',
    facultyBookLoanDays: '60',
    premiumBookLoanDays: '45',
    autoRenewalEnabled: true,
    renewalFineBlockThreshold: '5.00'
  },
  cataloging: {
    defaultClassification: 'DDC',
    mandatoryFields: ['ISBN', 'Title', 'Author', 'Language'],
    z3950Loc: 'z3950.loc.gov:7090/Voyager',
    z3950WorldCat: 'zcat.oclc.org:210/OLUCWorldCat',
    sruLibraryHub: 'https://sru.libraryhub.jisc.ac.uk/sru',
    mediaCodeBook: 'BOOK',
    mediaIconBook: 'book-open',
    mediaCodeDvd: 'DVD',
    mediaIconDvd: 'disc',
    mediaCodeAudio: 'AUDIO',
    mediaIconAudio: 'headphones'
  },
  privacy: {
    anonymizeOnReturn: true,
    passwordRequirement: '8-character alphanumeric',
    autoExpirationUnit: 'Years',
    autoExpirationValue: '2',
    permissionLevels: ['Super Admin', 'Staff', 'Read-Only']
  },
  notifications: {
    firstAlertDaysBefore: '3',
    secondAlertDaysAfter: '1',
    finalNoticeDaysAfter: '7',
    emailTemplate: 'Dear [Patron_Name], your item [Book_Title] is due on [Due_Date]. Please return or renew it before the due date.',
    smsTemplate: 'Reminder: [Book_Title] is due on [Due_Date].',
    smsGateway: 'Twilio',
    smtpServer: 'smtp.library.local',
    pickupWindowDays: '5'
  },
  opac: {
    fuzziness: '65',
    facetFilters: ['Year', 'Branch', 'Language', 'Availability'],
    newArrivalsDays: '30'
  }
};

export default function SettingsPage({ user, onLogout }) {
  const [loanPolicies, setLoanPolicies] = useState([]);
  const [dueDatePreview, setDueDatePreview] = useState(null);
  const [calculator, setCalculator] = useState({
    itemType: 'book',
    checkoutDate: today()
  });
  const [settings, setSettings] = useState(defaultSettings);
  const [error, setError] = useState('');

  const getDailyFineRate = (itemType) => {
    const normalized = String(itemType || 'book').toLowerCase();
    if (normalized === 'dvd') {
      return settings.dueDates.dvdDailyFineRate;
    }
    if (normalized === 'audiobook') {
      return settings.dueDates.audiobookDailyFineRate;
    }
    return settings.dueDates.bookDailyFineRate;
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const calculatePreview = async (itemType, checkoutDate, policiesOverride = loanPolicies) => {
    try {
      const response = await circulationAPI.calculateDueDate(itemType, checkoutDate);
      setDueDatePreview(response.data.data);
      setError('');
    } catch (err) {
      const localPreview = buildLocalDueDatePreview(itemType, checkoutDate, policiesOverride);
      if (localPreview) {
        setDueDatePreview(localPreview);
        setError('');
        return;
      }

      setError(err.response?.data?.message || err.message || 'Failed to calculate due date');
    }
  };

  const handleCalculatorChange = async (e) => {
    const { name, value } = e.target;
    const next = { ...calculator, [name]: value };
    setCalculator(next);
    await calculatePreview(next.itemType, next.checkoutDate);
  };

  const updateSectionField = (section, field, value) => {
    setSettings((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value
      }
    }));
  };

  const toggleSectionListValue = (section, field, value) => {
    setSettings((current) => {
      const currentValues = current[section][field];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        [section]: {
          ...current[section],
          [field]: nextValues
        }
      };
    });
  };

  useEffect(() => {
    const loadLoanPolicies = async () => {
      try {
        const response = await circulationAPI.getLoanPolicies();
        const policies = response.data.data;
        setLoanPolicies(policies);

        if (policies.length > 0) {
          await calculatePreview(calculator.itemType, calculator.checkoutDate, policies);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load loan policies');
      }
    };
    loadLoanPolicies();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <AppSidebar user={user} onLogout={onLogout} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 rounded-3xl bg-[linear-gradient(135deg,_#1d4ed8,_#0f172a)] p-6 text-white shadow-xl">
              <p className="text-sm uppercase tracking-[0.25em] text-blue-100">Settings</p>
              <h2 className="mt-2 text-3xl font-bold">System Configuration</h2>
              <p className="mt-2 max-w-3xl text-sm text-blue-100">
                Manage due dates, cataloging standards, patron privacy, notifications, and OPAC behavior from one settings workspace.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Settings Sections</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{SETTINGS_SECTIONS.length}</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Default Classification</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{settings.cataloging.defaultClassification}</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Renewal Limit</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{settings.dueDates.renewalLimit} times</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[260px_1fr]">
              <aside className="xl:sticky xl:top-6 xl:self-start">
                <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900">Quick Navigation</h3>
                  <p className="mt-1 text-sm text-slate-600">Jump to a settings group without digging through a long page.</p>

                  <div className="mt-4 space-y-2">
                    {SETTINGS_SECTIONS.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => scrollToSection(section.id)}
                        className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-blue-50"
                      >
                        <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                        <p className="text-xs text-slate-500">{section.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="space-y-6">
                <section id="due-dates" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-2xl font-semibold text-slate-900">Automated Due Dates</h3>
                  <p className="mt-2 text-sm text-slate-600">Preview due dates and confirm your loan period rules without leaving settings.</p>

                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                        <div className="space-y-4">
                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Item Type</span>
                            <select
                              name="itemType"
                              value={calculator.itemType}
                              onChange={handleCalculatorChange}
                              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                              {loanPolicies.map((policy) => (
                                <option key={policy.itemType} value={policy.itemType}>
                                  {policy.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Checkout Date</span>
                            <input
                              name="checkoutDate"
                              type="date"
                              value={calculator.checkoutDate}
                              onChange={handleCalculatorChange}
                              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4 sm:p-5">
                        <h4 className="text-lg font-semibold text-slate-900">Circulation Rule Controls</h4>
                        <p className="mt-1 text-sm text-slate-600">
                          Define renewals, hard due dates, hold limits, and grace periods from the same settings section.
                        </p>

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <label className="block rounded-2xl bg-white p-4">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Renewal Limits</span>
                            <input
                              value={settings.dueDates.renewalLimit}
                              onChange={(e) => updateSectionField('dueDates', 'renewalLimit', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <p className="mt-2 text-xs text-slate-500">Maximum number of renewals per item.</p>
                          </label>

                          <label className="block rounded-2xl bg-white p-4">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Hold (Request) Limits</span>
                            <input
                              value={settings.dueDates.holdRequestLimit}
                              onChange={(e) => updateSectionField('dueDates', 'holdRequestLimit', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <p className="mt-2 text-xs text-slate-500">Maximum number of active holds per user.</p>
                          </label>

                          <label className="block rounded-2xl bg-white p-4">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Grace Periods</span>
                            <input
                              value={settings.dueDates.gracePeriodDays}
                              onChange={(e) => updateSectionField('dueDates', 'gracePeriodDays', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <p className="mt-2 text-xs text-slate-500">Buffer days before an item is marked late.</p>
                          </label>

                          <div className="rounded-2xl bg-white p-4">
                            <label className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-gray-700">Hard Due Dates</span>
                              <input
                                type="checkbox"
                                checked={settings.dueDates.hardDueDateEnabled}
                                onChange={(e) => updateSectionField('dueDates', 'hardDueDateEnabled', e.target.checked)}
                              />
                            </label>
                            <input
                              type="date"
                              value={settings.dueDates.hardDueDate}
                              onChange={(e) => updateSectionField('dueDates', 'hardDueDate', e.target.value)}
                              disabled={!settings.dueDates.hardDueDateEnabled}
                              className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                            />
                            <p className="mt-2 text-xs text-slate-500">Force all items back by a semester or inventory deadline.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="self-start rounded-2xl bg-blue-50 p-4">
                      <h4 className="text-lg font-semibold text-slate-900">Preview</h4>
                      {dueDatePreview ? (
                        <>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-700">{dueDatePreview.label}</span>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{dueDatePreview.loanPeriodDays} days</span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-slate-500">Checkout</p>
                              <p className="mt-1 font-semibold text-slate-900">{dueDatePreview.checkoutDate}</p>
                            </div>
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-slate-500">Due Date</p>
                              <p className="mt-1 font-semibold text-slate-900">{dueDatePreview.dueDate}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="mt-4 text-sm text-slate-600">Select an item type to preview its due date.</p>
                      )}

                      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                        <p className="text-sm font-medium text-slate-700">Current loan rules</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          {loanPolicies.map((policy) => (
                            <div key={policy.itemType} className="flex items-center justify-between">
                              <div>
                                <span>{policy.label}</span>
                                <p className="text-xs text-slate-500">
                                  Fine: ${getDailyFineRate(policy.itemType)}/day
                                </p>
                              </div>
                              <span className="font-semibold text-slate-900">{policy.isBorrowable ? `${policy.loanPeriodDays} days` : 'Library use only'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <h4 className="text-lg font-semibold text-slate-900">Automated Notifications & Alerts</h4>
                      <p className="mt-1 text-sm text-slate-600">
                        Control reminder timing and item-type-specific "coming due" thresholds.
                      </p>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <label className="block rounded-2xl bg-white p-4">
                          <span className="mb-1 block text-sm font-medium text-gray-700">Before Due</span>
                          <input value={settings.dueDates.reminderBeforeDays} onChange={(e) => updateSectionField('dueDates', 'reminderBeforeDays', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          <p className="mt-2 text-xs text-slate-500">Days before due date.</p>
                        </label>
                        <label className="flex items-center justify-between rounded-2xl bg-white p-4">
                          <div>
                            <span className="block text-sm font-medium text-gray-700">On Due Date</span>
                            <p className="mt-2 text-xs text-slate-500">Send a due-date reminder.</p>
                          </div>
                          <input type="checkbox" checked={settings.dueDates.reminderOnDueDate} onChange={(e) => updateSectionField('dueDates', 'reminderOnDueDate', e.target.checked)} />
                        </label>
                        <label className="block rounded-2xl bg-white p-4">
                          <span className="mb-1 block text-sm font-medium text-gray-700">After Due</span>
                          <input value={settings.dueDates.reminderAfterDays} onChange={(e) => updateSectionField('dueDates', 'reminderAfterDays', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          <p className="mt-2 text-xs text-slate-500">Days after due date.</p>
                        </label>
                      </div>

                      <div className="mt-4 rounded-2xl bg-white p-4">
                        <p className="text-sm font-medium text-slate-900">"Coming Due" Thresholds by Item Type</p>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Books</span>
                            <input value={settings.dueDates.comingDueBookDays} onChange={(e) => updateSectionField('dueDates', 'comingDueBookDays', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">DVDs</span>
                            <input value={settings.dueDates.comingDueDvdDays} onChange={(e) => updateSectionField('dueDates', 'comingDueDvdDays', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Audiobooks</span>
                            <input value={settings.dueDates.comingDueAudiobookDays} onChange={(e) => updateSectionField('dueDates', 'comingDueAudiobookDays', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <h4 className="text-lg font-semibold text-slate-900">Fine & Fee Management</h4>
                      <p className="mt-1 text-sm text-slate-600">
                        Define late-fee behavior and set the point where items should be treated as lost.
                      </p>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <label className="block rounded-2xl bg-white p-4">
                          <span className="mb-1 block text-sm font-medium text-gray-700">Books</span>
                          <input value={settings.dueDates.bookDailyFineRate} onChange={(e) => updateSectionField('dueDates', 'bookDailyFineRate', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                        <label className="block rounded-2xl bg-white p-4">
                          <span className="mb-1 block text-sm font-medium text-gray-700">DVDs</span>
                          <input value={settings.dueDates.dvdDailyFineRate} onChange={(e) => updateSectionField('dueDates', 'dvdDailyFineRate', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                        <label className="block rounded-2xl bg-white p-4">
                          <span className="mb-1 block text-sm font-medium text-gray-700">Audiobooks</span>
                          <input value={settings.dueDates.audiobookDailyFineRate} onChange={(e) => updateSectionField('dueDates', 'audiobookDailyFineRate', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                      </div>

                      <label className="mt-4 block rounded-2xl bg-white p-4">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Maximum Fine Cap</span>
                        <input value={settings.dueDates.maxFineCap} onChange={(e) => updateSectionField('dueDates', 'maxFineCap', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        <p className="mt-2 text-xs text-slate-500">Maximum fee before the item is treated as lost.</p>
                      </label>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <h4 className="text-lg font-semibold text-slate-900">Calendar Integration & Blackout Dates</h4>
                      <p className="mt-1 text-sm text-slate-600">
                        Prevent due dates from landing on closures, and define seasonal fixed-date rules.
                      </p>

                      <div className="mt-4 space-y-3">
                        <label className="flex items-center justify-between rounded-2xl bg-white p-4">
                          <div>
                            <span className="block text-sm font-medium text-gray-700">Holiday Exclusion</span>
                            <p className="mt-1 text-xs text-slate-500">Push due dates to the next business day.</p>
                          </div>
                          <input type="checkbox" checked={settings.dueDates.holidayExclusionEnabled} onChange={(e) => updateSectionField('dueDates', 'holidayExclusionEnabled', e.target.checked)} />
                        </label>
                        <label className="flex items-center justify-between rounded-2xl bg-white p-4">
                          <div>
                            <span className="block text-sm font-medium text-gray-700">Sunday Blackout</span>
                            <p className="mt-1 text-xs text-slate-500">Treat Sundays as closed days.</p>
                          </div>
                          <input type="checkbox" checked={settings.dueDates.sundayBlackout} onChange={(e) => updateSectionField('dueDates', 'sundayBlackout', e.target.checked)} />
                        </label>
                        <label className="block rounded-2xl bg-white p-4">
                          <span className="mb-1 block text-sm font-medium text-gray-700">Holiday Calendar</span>
                          <input value={settings.dueDates.holidayCalendarName} onChange={(e) => updateSectionField('dueDates', 'holidayCalendarName', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                      </div>

                      <div className="mt-4 rounded-2xl bg-white p-4">
                        <label className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Seasonal Rules</span>
                          <input type="checkbox" checked={settings.dueDates.seasonalRuleEnabled} onChange={(e) => updateSectionField('dueDates', 'seasonalRuleEnabled', e.target.checked)} />
                        </label>
                        <input value={settings.dueDates.seasonalRuleName} onChange={(e) => updateSectionField('dueDates', 'seasonalRuleName', e.target.value)} disabled={!settings.dueDates.seasonalRuleEnabled} className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100" />
                        <input type="date" value={settings.dueDates.seasonalRuleDate} onChange={(e) => updateSectionField('dueDates', 'seasonalRuleDate', e.target.value)} disabled={!settings.dueDates.seasonalRuleEnabled} className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100" />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <h4 className="text-lg font-semibold text-slate-900">Patron-Type Specific Rules</h4>
                      <p className="mt-1 text-sm text-slate-600">
                        Adjust loan periods by patron category instead of using one rule for everyone.
                      </p>

                      <label className="mt-4 block rounded-2xl bg-white p-4">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Active Patron Tier Preview</span>
                        <select value={settings.dueDates.patronTierMode} onChange={(e) => updateSectionField('dueDates', 'patronTierMode', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
                          <option value="Student">Student</option>
                          <option value="Faculty">Faculty</option>
                          <option value="Premium Member">Premium Member</option>
                        </select>
                      </label>

                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <label className="rounded-2xl bg-white p-4">
                          <span className="mb-1 block text-sm font-medium text-gray-700">Student Book Loan Days</span>
                          <input value={settings.dueDates.studentBookLoanDays} onChange={(e) => updateSectionField('dueDates', 'studentBookLoanDays', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                        <label className="rounded-2xl bg-white p-4">
                          <span className="mb-1 block text-sm font-medium text-gray-700">Faculty Book Loan Days</span>
                          <input value={settings.dueDates.facultyBookLoanDays} onChange={(e) => updateSectionField('dueDates', 'facultyBookLoanDays', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                        <label className="rounded-2xl bg-white p-4">
                          <span className="mb-1 block text-sm font-medium text-gray-700">Premium Member Loan Days</span>
                          <input value={settings.dueDates.premiumBookLoanDays} onChange={(e) => updateSectionField('dueDates', 'premiumBookLoanDays', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <h4 className="text-lg font-semibold text-slate-900">Advanced Renewal Logic</h4>
                    <p className="mt-1 text-sm text-slate-600">
                      Control automatic renewals and prevent renewals when fines are above a set threshold.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="flex items-center justify-between rounded-2xl bg-white p-4">
                        <div>
                          <span className="block text-sm font-medium text-gray-700">Auto-Renewal</span>
                          <p className="mt-1 text-xs text-slate-500">Renew automatically if no holds exist.</p>
                        </div>
                        <input type="checkbox" checked={settings.dueDates.autoRenewalEnabled} onChange={(e) => updateSectionField('dueDates', 'autoRenewalEnabled', e.target.checked)} />
                      </label>

                      <label className="block rounded-2xl bg-white p-4">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Renewal Blocker Threshold</span>
                        <input value={settings.dueDates.renewalFineBlockThreshold} onChange={(e) => updateSectionField('dueDates', 'renewalFineBlockThreshold', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        <p className="mt-2 text-xs text-slate-500">Block renewals when fines exceed this amount.</p>
                      </label>
                    </div>
                  </div>
                </section>

                <section id="cataloging" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-2xl font-semibold text-slate-900">Cataloging & Metadata Standards</h3>
                  <p className="mt-2 text-sm text-slate-600">Ensure every record follows the same grammar, classification rules, and media display patterns.</p>

                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Default Classification</span>
                        <select value={settings.cataloging.defaultClassification} onChange={(e) => updateSectionField('cataloging', 'defaultClassification', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
                          <option value="DDC">Dewey Decimal (DDC)</option>
                          <option value="LCC">Library of Congress (LCC)</option>
                          <option value="Custom/Alpha">Custom / Alpha</option>
                        </select>
                      </label>

                      <div className="mt-4">
                        <p className="mb-2 text-sm font-medium text-gray-700">Mandatory Fields</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {MANDATORY_FIELDS.map((field) => (
                            <label key={field} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                              <input type="checkbox" checked={settings.cataloging.mandatoryFields.includes(field)} onChange={() => toggleSectionListValue('cataloging', 'mandatoryFields', field)} />
                              <span>{field}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="mb-3 text-sm font-medium text-gray-700">Z39.50 / SRU Connections</p>
                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Library of Congress</span>
                          <input value={settings.cataloging.z3950Loc} onChange={(e) => updateSectionField('cataloging', 'z3950Loc', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">WorldCat</span>
                          <input value={settings.cataloging.z3950WorldCat} onChange={(e) => updateSectionField('cataloging', 'z3950WorldCat', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">SRU Endpoint</span>
                          <input value={settings.cataloging.sruLibraryHub} onChange={(e) => updateSectionField('cataloging', 'sruLibraryHub', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-medium text-gray-700">Media Type Icons</p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Books</p>
                        <input value={settings.cataloging.mediaCodeBook} onChange={(e) => updateSectionField('cataloging', 'mediaCodeBook', e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        <input value={settings.cataloging.mediaIconBook} onChange={(e) => updateSectionField('cataloging', 'mediaIconBook', e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">DVD</p>
                        <input value={settings.cataloging.mediaCodeDvd} onChange={(e) => updateSectionField('cataloging', 'mediaCodeDvd', e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        <input value={settings.cataloging.mediaIconDvd} onChange={(e) => updateSectionField('cataloging', 'mediaIconDvd', e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Audio</p>
                        <input value={settings.cataloging.mediaCodeAudio} onChange={(e) => updateSectionField('cataloging', 'mediaCodeAudio', e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        <input value={settings.cataloging.mediaIconAudio} onChange={(e) => updateSectionField('cataloging', 'mediaIconAudio', e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      </div>
                    </div>
                  </div>
                </section>

                <section id="privacy" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-2xl font-semibold text-slate-900">Patron Privacy & Security</h3>
                  <p className="mt-2 text-sm text-slate-600">Set privacy defaults, password standards, card expiration rules, and staff permission levels.</p>

                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <label className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">Circulation History Toggle</p>
                          <p className="text-sm text-slate-600">Anonymize on return</p>
                        </div>
                        <input type="checkbox" checked={settings.privacy.anonymizeOnReturn} onChange={(e) => updateSectionField('privacy', 'anonymizeOnReturn', e.target.checked)} />
                      </label>

                      <label className="mt-4 block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Password / PIN Requirement</span>
                        <select value={settings.privacy.passwordRequirement} onChange={(e) => updateSectionField('privacy', 'passwordRequirement', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
                          <option value="4-digit PIN">4-digit PIN</option>
                          <option value="6-digit PIN">6-digit PIN</option>
                          <option value="8-character alphanumeric">8-character alphanumeric</option>
                          <option value="12-character strong password">12-character strong password</option>
                        </select>
                      </label>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-gray-700">Auto-Expiration</span>
                          <input value={settings.privacy.autoExpirationValue} onChange={(e) => updateSectionField('privacy', 'autoExpirationValue', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-gray-700">Unit</span>
                          <select value={settings.privacy.autoExpirationUnit} onChange={(e) => updateSectionField('privacy', 'autoExpirationUnit', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
                            <option value="Months">Months</option>
                            <option value="Years">Years</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="mb-3 text-sm font-medium text-gray-700">Permission Levels</p>
                      <div className="space-y-2">
                        {PERMISSION_LEVELS.map((role) => (
                          <label key={role} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                            <span className="text-sm font-medium text-slate-900">{role}</span>
                            <input type="checkbox" checked={settings.privacy.permissionLevels.includes(role)} onChange={() => toggleSectionListValue('privacy', 'permissionLevels', role)} />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section id="notifications" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-2xl font-semibold text-slate-900">Notification & Communication Logic</h3>
                  <p className="mt-2 text-sm text-slate-600">Decide when alerts are sent, customize template text, and manage SMS or email delivery settings.</p>

                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="mb-3 text-sm font-medium text-gray-700">Trigger Timing</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <label className="block"><span className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">First Alert</span><input value={settings.notifications.firstAlertDaysBefore} onChange={(e) => updateSectionField('notifications', 'firstAlertDaysBefore', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" /></label>
                        <label className="block"><span className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Second Alert</span><input value={settings.notifications.secondAlertDaysAfter} onChange={(e) => updateSectionField('notifications', 'secondAlertDaysAfter', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" /></label>
                        <label className="block"><span className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Final Notice</span><input value={settings.notifications.finalNoticeDaysAfter} onChange={(e) => updateSectionField('notifications', 'finalNoticeDaysAfter', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" /></label>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">SMS Gateway</span><input value={settings.notifications.smsGateway} onChange={(e) => updateSectionField('notifications', 'smsGateway', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" /></label>
                        <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">SMTP Server</span><input value={settings.notifications.smtpServer} onChange={(e) => updateSectionField('notifications', 'smtpServer', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" /></label>
                      </div>

                      <label className="mt-4 block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Pickup Window</span>
                        <input value={settings.notifications.pickupWindowDays} onChange={(e) => updateSectionField('notifications', 'pickupWindowDays', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      </label>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="mb-3 text-sm font-medium text-gray-700">Template Editor</p>
                      <textarea value={settings.notifications.emailTemplate} onChange={(e) => updateSectionField('notifications', 'emailTemplate', e.target.value)} rows="5" className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      <textarea value={settings.notifications.smsTemplate} onChange={(e) => updateSectionField('notifications', 'smsTemplate', e.target.value)} rows="3" className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    </div>
                  </div>
                </section>

                <section id="opac" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-2xl font-semibold text-slate-900">OPAC Display Settings</h3>
                  <p className="mt-2 text-sm text-slate-600">Fine-tune public search behavior, what facets appear, and how new arrivals are defined.</p>

                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Search Fuzziness</span>
                        <input type="range" min="0" max="100" value={settings.opac.fuzziness} onChange={(e) => updateSectionField('opac', 'fuzziness', e.target.value)} className="w-full" />
                        <p className="mt-2 text-sm text-slate-600">Sensitivity: {settings.opac.fuzziness}%</p>
                      </label>

                      <label className="mt-4 block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">"New Arrivals" Logic</span>
                        <select value={settings.opac.newArrivalsDays} onChange={(e) => updateSectionField('opac', 'newArrivalsDays', e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
                          <option value="30">Last 30 days</option>
                          <option value="60">Last 60 days</option>
                          <option value="90">Last 90 days</option>
                        </select>
                      </label>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="mb-3 text-sm font-medium text-gray-700">Facet Filtering</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {FACET_FILTERS.map((facet) => (
                          <label key={facet} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                            <input type="checkbox" checked={settings.opac.facetFilters.includes(facet)} onChange={() => toggleSectionListValue('opac', 'facetFilters', facet)} />
                            <span>{facet}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

