import { listExercises } from "@/lib/queries";
import ExerciseManager from "./ExerciseManager";
import Nav from "../Nav";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const exercises = await listExercises();

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>動作庫</h1>
          <div className="sub">{exercises.length} 個動作</div>
        </div>
      </div>

      <Nav />

      <ExerciseManager exercises={exercises} />
    </main>
  );
}
