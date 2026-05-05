import React, { useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronUp, Building, Users, Calendar,
  BarChart2, Zap, Edit3, Download, HelpCircle, CheckCircle,
  AlertTriangle, ArrowRight, Info,
} from 'lucide-react';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  content: React.ReactNode;
}

const Step: React.FC<{ num: number; title: string; children: React.ReactNode }> = ({ num, title, children }) => (
  <div className="flex gap-3 mb-4">
    <div className="shrink-0 w-7 h-7 rounded-full bg-[#FFD700] text-[#1A1A1A] font-bold text-sm flex items-center justify-center mt-0.5">
      {num}
    </div>
    <div>
      <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{title}</p>
      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">{children}</div>
    </div>
  </div>
);

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300 mt-3">
    <Info size={16} className="shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />
    <span>{children}</span>
  </div>
);

const Warn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300 mt-3">
    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-500" />
    <span>{children}</span>
  </div>
);

const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color}`}>{children}</span>
);

export const HelpPage: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>('overview');

  const sections: Section[] = [
    {
      id: 'overview',
      icon: <BookOpen size={20} />,
      title: 'このアプリでできること',
      color: 'bg-gray-700',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            このアプリは<strong>ヤマト運輸の営業所向け交番（シフト）管理システム</strong>です。
            毎月のコース（配送ルート）と社員の割り当てを自動生成し、管理者が素早く確認・修正できます。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: <Zap size={18} className="text-yellow-500" />, text: 'AIがシフトを自動生成（5パターン提案）' },
              { icon: <Edit3 size={18} className="text-blue-500" />, text: '担当者をドラッグ＆ドロップで手動変更' },
              { icon: <BarChart2 size={18} className="text-purple-500" />, text: '労働時間・土日出勤の偏りをグラフで確認' },
              { icon: <Download size={18} className="text-green-500" />, text: 'CSV出力・印刷に対応' },
              { icon: <Calendar size={18} className="text-orange-500" />, text: '希望休・研修など予定を事前入力' },
              { icon: <CheckCircle size={18} className="text-teal-500" />, text: 'ルール違反・未割当を自動チェック' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="shrink-0 mt-0.5">{item.icon}</div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{item.text}</span>
              </div>
            ))}
          </div>
          <div className="bg-[#FFD700] bg-opacity-20 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-lg p-4">
            <p className="font-bold text-gray-800 dark:text-gray-100 mb-2">基本の流れ</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              {['①営業所登録', '②コース登録', '③社員登録', '④交番を自動生成', '⑤確認・修正', '⑥完成！'].map((s, i, arr) => (
                <React.Fragment key={i}>
                  <span className="bg-white dark:bg-gray-700 dark:text-gray-200 rounded px-2 py-1 font-medium shadow-sm">{s}</span>
                  {i < arr.length - 1 && <ArrowRight size={14} className="text-gray-400" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'setup-branch',
      icon: <Building size={20} />,
      title: 'ステップ①　営業所を登録する',
      color: 'bg-orange-500',
      content: (
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            はじめに「どの営業所のシフトを管理するか」を設定します。
            複数の営業所を登録して切り替えることもできます。
          </p>
          <Step num={1} title="トップ画面で「新しい営業所を追加」をタップ">
            <p>アプリを開くと営業所の選択画面が表示されます。「＋ 新しい営業所を追加」ボタンをタップしてください。</p>
          </Step>
          <Step num={2} title="営業所名を入力して保存">
            <p>「○○営業所」「△△センター」など、分かりやすい名前を入力して「追加」ボタンを押します。</p>
          </Step>
          <Step num={3} title="営業所を選択してログイン">
            <p>登録した営業所名をタップすると、その営業所の管理画面に入ります。</p>
          </Step>
          <Tip>営業所ごとにコース・社員・交番データが完全に分かれて管理されます。</Tip>
        </div>
      ),
    },
    {
      id: 'setup-course',
      icon: <Building size={20} />,
      title: 'ステップ②　コース（配送ルート）を登録する',
      color: 'bg-blue-500',
      content: (
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            コース管理画面でコース（配送ルート）を登録します。
            コース名・勤務時間・休憩時間を設定してください。
          </p>
          <Step num={1} title="「コース」をタップ">
            <p>スマホは画面下部のナビゲーションバー、PCは左サイドバーから「コース管理」を選択します。</p>
          </Step>
          <Step num={2} title="「＋ コースを追加」ボタンをタップ">
            <p>コース名（例: A-1便、午前便 など）を入力します。</p>
          </Step>
          <Step num={3} title="勤務時間と休憩時間を入力">
            <p>
              開始時間・終了時間・休憩時間（分）を入力します。
              これが労働時間の計算に使われます。
            </p>
          </Step>
          <Warn>
            コースは最低1つ以上登録しないと交番の自動生成ができません。先にコース登録を済ませてください。
          </Warn>
        </div>
      ),
    },
    {
      id: 'setup-employee',
      icon: <Users size={20} />,
      title: 'ステップ③　社員を登録する',
      color: 'bg-green-600',
      content: (
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            社員管理画面で社員を登録します。
            担当できるコース・出勤日数の範囲を設定することで、自動生成の精度が上がります。
          </p>
          <Step num={1} title="「社員」をタップ →「＋ 社員を追加」をタップ">
            <p>スマホは画面下部のナビゲーションバー、PCは左サイドバーから「社員管理」を選択します。社員名と社員番号を入力します。</p>
          </Step>
          <Step num={2} title="担当可能なコースにチェックを入れる">
            <p>
              この社員が担当できるコースにチェックを入れてください。
              チェックされたコースにのみ自動で割り当てられます。
            </p>
          </Step>
          <Step num={3} title="月間出勤日数の範囲を設定">
            <p>
              「最小出勤日数」と「最大出勤日数」を設定します。
              自動生成はこの範囲内で出勤日数を調整します。
            </p>
          </Step>
          <Tip>
            「最大出勤日数」を少なく設定すると、その社員は休みが多めになります。
            パート社員など出勤日数が少ない方に活用してください。
          </Tip>
        </div>
      ),
    },
    {
      id: 'create-shift',
      icon: <Calendar size={20} />,
      title: 'ステップ④　交番を自動生成する',
      color: 'bg-[#1A1A1A]',
      content: (
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            コースと社員の登録が終わったら、「交番管理」画面で自動生成を行います。
          </p>
          <Step num={1} title="「交番管理」画面を開き、対象月を選ぶ">
            <p>画面上部の月選択で、作成したい月（例: 2026-06）を選択します。</p>
          </Step>
          <Step num={2} title="（任意）日別コース設定を確認する">
            <p>
              「日別コース設定」タブを開くと、各日付にどのコースが必要かを
              チェックボックスで設定できます。休日などコースが不要な日は
              チェックを外しておくと精度が上がります。
            </p>
            <p className="mt-1">
              「前月コピー」ボタンを使うと、前月の日別コース設定を曜日ごとに自動コピーできます。
              毎月設定し直す手間が省けます。
            </p>
          </Step>
          <Step num={3} title="（任意）希望休・予定を入力する">
            <p>
              「予定」タブを開くと、社員ごとに希望休・会議・研修などを
              日別で入力できます。入力した予定は自動生成に反映されます。
            </p>
          </Step>
          <Step num={4} title="優先ルールを選んで「自動生成」をタップ">
            <div className="space-y-1">
              <p>3種類の優先ルールから選べます：</p>
              <ul className="ml-4 space-y-1">
                <li><Badge color="bg-gray-200 text-gray-800">標準</Badge>　全体のバランスを重視した標準的なシフト</li>
                <li><Badge color="bg-blue-100 text-blue-800">連休防止</Badge>　飛び石休みや連続出勤を避けるシフト</li>
                <li><Badge color="bg-purple-100 text-purple-800">公平性重視</Badge>　土日出勤と労働時間の偏りを最小化</li>
              </ul>
            </div>
          </Step>
          <Step num={5} title="5パターンの提案から選ぶ">
            <p>
              自動生成すると「提案1〜提案5」が表示されます。
              それぞれをタップして内容を確認し、最も良いパターンを選んでください。
            </p>
          </Step>
          <Tip>
            「シフト診断」エリアで精度スコアとルール違反が確認できます。
            スコアが高いほど理想的な交番です。
          </Tip>
        </div>
      ),
    },
    {
      id: 'edit-shift',
      icon: <Edit3 size={20} />,
      title: 'ステップ⑤　交番を手動で修正する',
      color: 'bg-indigo-600',
      content: (
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            自動生成後に細かい調整が必要な場合は、手動で担当者を変更できます。
          </p>

          <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-4">
            <p className="font-bold text-indigo-800 dark:text-indigo-300 mb-3">「社員」タブでのドラッグ＆ドロップ</p>
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-1">
                  📱 スマホの場合（長押しドラッグ）
                </p>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-decimal">
                  <li>入れ替えたいセルを<strong>約0.5秒間押し続ける</strong></li>
                  <li>振動（バイブ）を感じたらドラッグ開始のサイン</li>
                  <li>指を離さずに別のセルまで<strong>スライド</strong>する（スクロールも可能）</li>
                  <li>目的のセルの上で<strong>指を離す</strong>と入れ替え完了</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-1">
                  💻 PCの場合（ドラッグ）
                </p>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-decimal">
                  <li>セルをマウスでクリックしたまま別のセルへドラッグ</li>
                  <li>目的のセルでマウスを離すと入れ替え完了</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-1">
                  📋 「コース名」タブでプルダウン変更
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                  「コース名」タブでは各セルのプルダウンから担当者を直接選択することもできます。
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-3">
            <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-2">👤 社員名をタップすると詳細が見られます</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              「社員」タブで社員名をタップすると、その社員の月間統計（出勤日数・休日数・土日出勤・労働時間）と
              日別スケジュール一覧が表示されます。
            </p>
          </div>

          <Tip>
            ドラッグ中は動かしているセルが黄色くハイライトされ、
            移動先のセルに黄色い枠が表示されます。休み（○）のセルとも入れ替えが可能です。
          </Tip>
        </div>
      ),
    },
    {
      id: 'views',
      icon: <Calendar size={20} />,
      title: '画面の見方（タブ切り替え・警告バッジ）',
      color: 'bg-teal-600',
      content: (
        <div className="space-y-3">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-300">
            <p className="font-semibold mb-1">🔴 タブの赤いバッジについて</p>
            <ul className="space-y-1 ml-2">
              <li>・<strong>社員</strong>タブのバッジ ＝ ルール違反の件数（例：出勤日数オーバー）</li>
              <li>・<strong>コース名</strong>タブのバッジ ＝ 未割当コースの件数</li>
            </ul>
            <p className="mt-1">バッジが0になるよう修正するのが理想です。</p>
          </div>
          {[
            {
              name: '社員',
              desc: '社員ごとに横方向に日付が並んだ表です。出勤日数・休日数・労働時間が一目でわかります。社員名をタップすると月間統計と日別詳細が表示されます。',
              note: '赤字の出勤数は設定した最大/最小日数を超えているサインです。ドラッグ＆ドロップでの手動変更もこのタブで行います。',
            },
            {
              name: 'コース名',
              desc: 'コースごとに誰が担当するかを日別に確認できる表です。プルダウンで担当者を直接変更することができます。',
              note: '赤いセルは担当者が未割当の状態です。早めに割り当ててください。',
            },
            {
              name: 'コース偏差',
              desc: '各コースを社員が何回担当しているかを集計した表です。特定の社員への偏りを一目で確認できます。',
              note: '赤くハイライトされたセルは他の社員より2回以上多く担当している状態です。',
            },
            {
              name: '日別コース設定',
              desc: '自動生成の対象コースを日別にON/OFFできます。特定の曜日だけ休みのコースなどを設定するのに使います。',
              note: '変更後は必ず再度「自動生成」を実行してください。',
            },
            {
              name: '予定',
              desc: '社員ごとに希望休・会議・研修など予定を入力できます。入力した予定は自動生成に反映されます。',
              note: '「希望休」は最優先で反映されます。',
            },
          ].map((tab) => (
            <div key={tab.name} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge color="bg-[#1A1A1A] text-white">{tab.name}</Badge>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{tab.desc}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">💡 {tab.note}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'dashboard',
      icon: <BarChart2 size={20} />,
      title: 'ダッシュボードの使い方',
      color: 'bg-purple-600',
      content: (
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            ダッシュボードでは保存済みの交番データをグラフで分析できます。
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: '総合精度スコア', desc: '交番の完成度を0〜100点で表示。80点以上が理想です。' },
              { label: '未割当コース', desc: '担当者が設定されていないコースの件数。0件が目標です。' },
              { label: 'ルール違反件数', desc: '出勤日数オーバーなどのルール違反の件数。0件が理想です。' },
              { label: '土日出勤格差', desc: '最も多い人と少ない人の土日出勤日数の差。2日以内が理想です。' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">{kpi.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.desc}</p>
              </div>
            ))}
          </div>
          <Tip>
            画面上部の「対象月」プルダウンで、過去のシフトデータも振り返ることができます。
          </Tip>
        </div>
      ),
    },
    {
      id: 'export',
      icon: <Download size={20} />,
      title: 'CSV出力・印刷・バックアップ',
      color: 'bg-green-700',
      content: (
        <div className="space-y-3">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="font-semibold text-gray-800 dark:text-gray-100 mb-2">CSV出力</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              「CSV出力」ボタンをタップすると、社員ごとの日別シフトデータがCSVファイルでダウンロードされます。
              ExcelやGoogleスプレッドシートで開いて活用できます。
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="font-semibold text-gray-800 dark:text-gray-100 mb-2">印刷（PDF保存）</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              「印刷」ボタンをタップするとブラウザの印刷ダイアログが開きます。
              印刷先で「PDFに保存」を選ぶとPDFファイルとして保存できます。A4横向きで1ページに収まるよう自動調整されます。
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="font-semibold text-blue-800 dark:text-blue-300 mb-3">📦 バックアップ出力・読込（データのエクスポート/インポート）</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              アプリのデータ（営業所・コース・社員・交番すべて）をJSONファイルとして書き出し・読み込みできます。
              <strong>機種変更・スマホ切り替え・誤削除の復元</strong>に使用してください。
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">📤 バックアップ出力（エクスポート）の手順</p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                  <li>💻 <strong>PC：</strong>左サイドバーの「バックアップ出力」をクリック</li>
                  <li>📱 <strong>スマホ：</strong>画面上部の <strong>↓ アイコン</strong>を直接タップ</li>
                  <li>「yamato-backup-日付.json」がダウンロードされます</li>
                  <li>クラウドストレージなど安全な場所に保存してください</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">📥 バックアップ読込（インポート）の手順</p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                  <li>💻 <strong>PC：</strong>左サイドバーの「バックアップ読込」をクリック</li>
                  <li>📱 <strong>スマホ：</strong>画面上部の <strong>↑ アイコン</strong>をタップ</li>
                  <li>保存しておいたJSONファイルを選択</li>
                  <li>確認ダイアログが表示されるので「OK」を押す</li>
                  <li>すべてのデータが復元されます</li>
                </ul>
              </div>
            </div>
          </div>
          <Warn>
            バックアップ読込は<strong>現在のデータをすべて上書き</strong>します。読み込む前に現在のデータをバックアップ出力しておくことをお勧めします。
          </Warn>
          <Tip>
            月1回など定期的にバックアップ出力しておくと、万が一の際も安心です。
          </Tip>
        </div>
      ),
    },
    {
      id: 'faq',
      icon: <HelpCircle size={20} />,
      title: 'よくある質問',
      color: 'bg-gray-600',
      content: (
        <div className="space-y-4">
          {[
            {
              q: 'データはどこに保存されていますか？',
              a: 'データはこのスマホ・PCのブラウザ（ローカルストレージ）に保存されます。アプリを閉じてもデータは残りますが、ブラウザのキャッシュをクリアすると消えることがあります。「バックアップ出力」機能で定期的にJSONファイルを保存しておくことをお勧めします。',
            },
            {
              q: '別のスマホやPCに乗り換えたい場合は？',
              a: '旧端末で「バックアップ出力」をタップしてJSONファイルをダウンロードし、そのファイルをメール・クラウドなどで新端末に送ってください。新端末でこのアプリを開き「バックアップ読込」でJSONファイルを選択すると、すべてのデータが移行されます。',
            },
            {
              q: '自動生成したシフトが気に入らない場合は？',
              a: '「自動生成」を押すたびに5つの異なるパターンが生成されます。「提案1〜5」を切り替えて確認し、最も良いものを選んでください。さらに細かく修正したい場合は「社員」タブでドラッグ＆ドロップで入れ替えられます。',
            },
            {
              q: '「コース偏差」で赤くなっているセルがあります',
              a: '特定の社員が平均より2回以上多くそのコースを担当している状態です。「コース名」タブで他の社員に担当を変更してください。',
            },
            {
              q: '希望休が反映されない場合は？',
              a: '「予定」タブで希望休を入力した後、再度「自動生成」を実行してください。既に生成済みのシフトには自動では反映されません。',
            },
            {
              q: '営業所を間違えて操作してしまった場合は？',
              a: '画面左下の「営業所切替」ボタンで営業所の選択画面に戻れます。正しい営業所を選び直してください。',
            },
          ].map((faq, i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Q. {faq.q}</p>
              </div>
              <div className="px-4 py-3 dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">A. {faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-3 pb-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-[#FFD700] rounded-lg">
          <BookOpen size={24} className="text-[#1A1A1A]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">使い方ガイド</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">交番管理システムの操作説明</p>
        </div>
      </div>

      {sections.map((section) => {
        const isOpen = openId === section.id;
        return (
          <div key={section.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={() => setOpenId(isOpen ? null : section.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg text-white ${section.color}`}>
                  {section.icon}
                </div>
                <span className="font-semibold text-gray-800 dark:text-gray-100">{section.title}</span>
              </div>
              {isOpen
                ? <ChevronUp size={20} className="text-gray-400 shrink-0" />
                : <ChevronDown size={20} className="text-gray-400 shrink-0" />
              }
            </button>
            {isOpen && (
              <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-700">
                {section.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
