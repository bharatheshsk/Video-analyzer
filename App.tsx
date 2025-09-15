/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
// Copyright 2024 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import c from 'classnames';
import {useRef, useState} from 'react';
import {generateContent, uploadFile} from './api';
import Chart from './Chart.jsx';
import functions from './functions';
import modes from './modes';
import {timeToSecs} from './utils';
import VideoPlayer from './VideoPlayer.jsx';

const chartModes = Object.keys(modes.Chart.subModes);

export default function App() {
  const [vidUrl, setVidUrl] = useState(null);
  const [file, setFile] = useState(null);
  const [timecodeList, setTimecodeList] = useState(null);
  const [requestedTimecode, setRequestedTimecode] = useState(null);
  const [selectedMode, setSelectedMode] = useState(Object.keys(modes)[0]);
  // FIX: Explicitly type activeMode state.
  const [activeMode, setActiveMode] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [chartMode, setChartMode] = useState(chartModes[0]);
  const [chartPrompt, setChartPrompt] = useState('');
  const [chartLabel, setChartLabel] = useState('');
  const [currentView, setCurrentView] = useState(null);
  const [theme] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  );
  // FIX: Correctly type scrollRef to allow calling .scrollTo() and fix ref assignment.
  const scrollRef = useRef<HTMLElement>(null);
  const isCustomMode = selectedMode === 'Custom';
  const isChartMode = selectedMode === 'Chart';
  const isCustomChartMode = isChartMode && chartMode === 'Custom';
  const hasSubMode = isCustomMode || isChartMode;

  const onModeSelect = async (mode) => {
    setActiveMode(mode);
    setIsLoading(true);
    setTimecodeList(null);
    setCurrentView(null);
    setChartLabel(chartPrompt);

    const resp = await generateContent(
      isCustomMode
        ? modes[mode].prompt(customPrompt)
        : isChartMode
          ? modes[mode].prompt(
              isCustomChartMode ? chartPrompt : modes[mode].subModes[chartMode],
            )
          : modes[mode].prompt,
      functions({}),
      file,
    );

    const call = resp.functionCalls?.[0];

    if (call) {
      const {name, args} = call;
      let data;

      if (
        name === 'set_timecodes' ||
        name === 'set_timecodes_with_objects'
      ) {
        data = args.timecodes.map((t) => ({
          ...t,
          text: t.text.replaceAll("\\'", "'"),
        }));
      } else if (name === 'set_timecodes_with_numeric_values') {
        data = args.timecodes;
      }

      if (data) {
        setTimecodeList(data);
        setCurrentView(modes[mode].defaultView);
      }
    }

    setIsLoading(false);
    // FIX: Check if scrollRef.current exists before using it.
    scrollRef.current?.scrollTo({top: 0});
  };

  const uploadVideo = async (e) => {
    e.preventDefault();
    setIsLoadingVideo(true);
    setVidUrl(URL.createObjectURL(e.dataTransfer.files[0]));
    setTimecodeList(null);
    setCurrentView(null);
    setVideoError(false);

    const file = e.dataTransfer.files[0];

    try {
      const res = await uploadFile(file);
      setFile(res);
      setIsLoadingVideo(false);
    } catch (e) {
      setVideoError(true);
      setIsLoadingVideo(false);
    }
  };

  return (
    <main
      className={theme}
      onDrop={uploadVideo}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => {}}
      onDragLeave={() => {}}>
      <section className="top">
        {vidUrl && !isLoadingVideo && (
          <>
            <div className={c('modeSelector', {hide: !showSidebar})}>
              {hasSubMode ? (
                <>
                  <div>
                    {isCustomMode ? (
                      <>
                        <h2>Custom prompt:</h2>
                        <textarea
                          placeholder="Type a custom prompt..."
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onModeSelect(selectedMode);
                            }
                          }}
                          // FIX: Use number for rows attribute.
                          rows={5}
                        />
                      </>
                    ) : (
                      <>
                        <h2>Chart this video by:</h2>

                        <div className="modeList">
                          {chartModes.map((mode) => (
                            <button
                              key={mode}
                              className={c('button', {
                                active: mode === chartMode,
                              })}
                              onClick={() => setChartMode(mode)}>
                              {mode}
                            </button>
                          ))}
                        </div>
                        <textarea
                          className={c({active: isCustomChartMode})}
                          placeholder="Or type a custom prompt..."
                          value={chartPrompt}
                          onChange={(e) => setChartPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onModeSelect(selectedMode);
                            }
                          }}
                          onFocus={() => setChartMode('Custom')}
                          // FIX: Use number for rows attribute.
                          rows={2}
                        />
                      </>
                    )}
                    <button
                      className="button generateButton"
                      onClick={() => onModeSelect(selectedMode)}
                      disabled={
                        (isCustomMode && !customPrompt.trim()) ||
                        (isChartMode &&
                          isCustomChartMode &&
                          !chartPrompt.trim())
                      }>
                      ▶️ Generate
                    </button>
                  </div>
                  <div className="backButton">
                    <button
                      onClick={() => setSelectedMode(Object.keys(modes)[0])}>
                      <span className="icon">chevron_left</span>
                      Back
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2>Explore this video via:</h2>
                    <div className="modeList">
                      {Object.entries(modes).map(([mode, {emoji}]) => (
                        <button
                          key={mode}
                          className={c('button', {
                            active: mode === selectedMode,
                          })}
                          onClick={() => setSelectedMode(mode)}>
                          <span className="emoji">{emoji}</span> {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <button
                      className="button generateButton"
                      onClick={() => onModeSelect(selectedMode)}>
                      ▶️ Generate
                    </button>
                  </div>
                </>
              )}
              {timecodeList && (
                <div className="viewSelector">
                  <h2>View as:</h2>
                  <div className="modeList">
                    {/* FIX: Add a check for activeMode before using it as an index. */}
                    {activeMode && (modes[activeMode].views || []).map((view) => (
                      <button
                        key={view}
                        className={c('button', {
                          active: view === currentView,
                        })}
                        onClick={() => setCurrentView(view)}>
                        <span className="emoji">
                          {{
                            timeline: '📝',
                            list: '📄',
                            table: '🤓',
                            chart: '📈',
                          }[view] || '👁️'}
                        </span>
                        {view.charAt(0).toUpperCase() + view.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              className="collapseButton"
              onClick={() => setShowSidebar(!showSidebar)}>
              <span className="icon">
                {showSidebar ? 'chevron_left' : 'chevron_right'}
              </span>
            </button>
          </>
        )}

        <VideoPlayer
          url={vidUrl}
          requestedTimecode={requestedTimecode}
          timecodeList={timecodeList}
          jumpToTimecode={setRequestedTimecode}
          isLoadingVideo={isLoadingVideo}
          videoError={videoError}
        />
      </section>

      <div className={c('tools', {inactive: !vidUrl})}>
        <section
          className={c('output', {['mode' + activeMode]: activeMode})}
          ref={scrollRef}>
          {isLoading ? (
            <div className="loading">
              Waiting for model<span>...</span>
            </div>
          ) : timecodeList ? (
            <>
              {currentView === 'table' && (
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Description</th>
                      <th>Objects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timecodeList.map(({time, text, objects}, i) => (
                      <tr
                        key={i}
                        role="button"
                        onClick={() => setRequestedTimecode(timeToSecs(time))}>
                        <td>
                          <time>{time}</time>
                        </td>
                        <td>{text}</td>
                        <td>{objects.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {currentView === 'chart' && (
                <Chart
                  data={timecodeList}
                  yLabel={chartLabel}
                  jumpToTimecode={setRequestedTimecode}
                />
              )}
              {currentView === 'list' && (
                <ul>
                  {timecodeList.map(({time, text}, i) => (
                    <li key={i} className="outputItem">
                      <button
                        onClick={() => setRequestedTimecode(timeToSecs(time))}>
                        <time>{time}</time>
                        <p className="text">{text}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {currentView === 'timeline' &&
                timecodeList.map(({time, text}, i) => (
                  <>
                    <span
                      key={i}
                      className="sentence"
                      role="button"
                      onClick={() => setRequestedTimecode(timeToSecs(time))}>
                      <time>{time}</time>
                      <span>{text}</span>
                    </span>{' '}
                  </>
                ))}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
